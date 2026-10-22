import type { StoryResponse, StoryRing } from "@/lib/api/types";

export type RingState = "unseen" | "seen" | "none";

/** story-service answers 400 to more ids than this in one call. */
export const MAX_RING_BATCH = 100;

/** How long an answer is reused before an avatar that still shows it is asked about again. */
export const RING_TTL_MS = 60_000;

export function ringStateOf(stories: readonly StoryResponse[], own: boolean): RingState {
  if (stories.length === 0) return "none";
  const unseen = own
    ? stories.some((story) => story.status === "ACTIVE")
    : stories.some((story) => !story.viewedByMe);
  return unseen ? "unseen" : "seen";
}

export interface RingStore {
  /** A pure snapshot read, for `useSyncExternalStore`; undefined until the id has been answered. */
  get(userId: string): RingState | undefined;
  subscribe(userId: string, listener: () => void): () => void;
  /** What the viewer's own action just proved, stored as fresh without asking. */
  set(userId: string, state: RingState): void;
  /** Forgets the id, and asks again if an avatar still shows it. */
  invalidate(userId: string): void;
  /** Asks again for every id an avatar still shows whose answer is stale. */
  refresh(): void;
}

/**
 * A comment thread or an explore grid puts dozens of avatars on screen, each wanting its owner's
 * ring. Each one subscribes with that id; the ids that arrive within one tick leave as a single
 * request (in chunks of the server's cap), and an answer is reused until it is `ttlMs` old. An
 * avatar that stays mounted subscribes only once, so whoever owns the store calls `refresh` now and
 * then to renew the answers it holds. Nothing is evicted: like `resolveAuthors`' cache, the store
 * lives as long as the viewer's session.
 */
export function createRingStore({
  fetchRings,
  tickMs = 50,
  ttlMs = RING_TTL_MS,
  now = () => Date.now(),
  schedule = (run, ms) => {
    setTimeout(run, ms);
  },
}: {
  fetchRings: (userIds: string[]) => Promise<StoryRing[]>;
  tickMs?: number;
  ttlMs?: number;
  now?: () => number;
  schedule?: (run: () => void, ms: number) => void;
}): RingStore {
  const entries = new Map<string, { state: RingState; at: number }>();
  const listeners = new Map<string, Set<() => void>>();
  const queue = new Set<string>();
  // Which request is expected to answer each id in flight. `set` and `invalidate` take the id out, so
  // an answer to a question asked before them no longer matches and is dropped, not applied over them.
  const pending = new Map<string, number>();
  let requests = 0;
  let flushScheduled = false;

  function notify(userId: string) {
    listeners.get(userId)?.forEach((listener) => listener());
  }

  function enqueue(userId: string) {
    queue.add(userId);
    if (!flushScheduled) {
      flushScheduled = true;
      schedule(flush, tickMs);
    }
  }

  function askIfStale(userId: string) {
    const entry = entries.get(userId);
    if (!pending.has(userId) && (!entry || now() - entry.at > ttlMs)) enqueue(userId);
  }

  function flush() {
    flushScheduled = false;
    const userIds = [...queue];
    queue.clear();
    for (let i = 0; i < userIds.length; i += MAX_RING_BATCH) {
      send(userIds.slice(i, i + MAX_RING_BATCH));
    }
  }

  function send(userIds: string[]) {
    const request = ++requests;
    userIds.forEach((userId) => pending.set(userId, request));

    fetchRings(userIds)
      .then((rings) => {
        const answers = new Map<string, RingState>();
        for (const ring of rings) answers.set(ring.userId, ring.hasUnseen ? "unseen" : "seen");
        return answers;
      })
      // A failed request, or an answer that is not a list, must not leave its ids in flight forever:
      // they get "none" and are asked again once that answer is `ttlMs` old.
      .catch(() => new Map<string, RingState>())
      .then((answers) => {
        const at = now();
        const changed: string[] = [];
        for (const userId of userIds) {
          if (pending.get(userId) !== request) continue;
          pending.delete(userId);
          // Only accounts with a ring are listed; one missing from the answer has none.
          const state = answers.get(userId) ?? "none";
          if (entries.get(userId)?.state !== state) changed.push(userId);
          entries.set(userId, { state, at });
        }
        changed.forEach(notify);
      });
  }

  return {
    get: (userId) => entries.get(userId)?.state,

    subscribe(userId, listener) {
      const subscribers = listeners.get(userId) ?? new Set<() => void>();
      listeners.set(userId, subscribers);
      subscribers.add(listener);
      askIfStale(userId);

      return () => {
        subscribers.delete(listener);
      };
    },

    refresh() {
      listeners.forEach((subscribers, userId) => {
        if (subscribers.size) askIfStale(userId);
      });
    },

    set(userId, state) {
      const changed = entries.get(userId)?.state !== state;
      entries.set(userId, { state, at: now() });
      pending.delete(userId);
      queue.delete(userId);
      if (changed) notify(userId);
    },

    invalidate(userId) {
      const known = entries.delete(userId);
      pending.delete(userId);
      if (listeners.get(userId)?.size) enqueue(userId);
      if (known) notify(userId);
    },
  };
}
