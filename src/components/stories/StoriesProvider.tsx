"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import { getStoryRings, getUserStories } from "@/lib/api/stories";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";
import { firstUnseen, markStorySeen } from "@/lib/stories/navigation";
import {
  createRingStore,
  RING_TTL_MS,
  ringStateOf,
  type RingState,
  type RingStore,
} from "@/lib/stories/ring-store";
import type { Author } from "@/types/tiktok";

import { StoryViewer } from "./StoryViewer";

interface Stories {
  /**
   * Opens `author`'s stories in the player. False when there was nothing to show — the ring was
   * stale, and the caller goes to the profile instead — and while the session is still loading,
   * when there is no viewer yet to open them for.
   */
  openStories: (author: Author) => Promise<boolean>;
  /** What a player showed, handed over as it closes, so every avatar of those owners follows it. */
  syncRings: (groups: readonly StoryGroup[]) => void;
  /** The viewer posted or deleted a story: forget their ring and ask again. */
  invalidateOwnRing: () => void;
}

/** Outside a provider — a component tested alone — there are no rings and nothing to open. */
const NO_STORIES: Stories = {
  openStories: async () => false,
  syncRings: () => {},
  invalidateOwnRing: () => {},
};

const StoriesContext = createContext<{ store: RingStore | null; actions: Stories } | null>(null);

/** The stories being played, for the store they were opened under. */
interface Playing {
  store: RingStore;
  author: Author;
  groups: StoryGroup[];
  start: number;
}

function groupOf(userId: string, stories: StoryResponse[], own: boolean): StoryGroup {
  return { userId, stories, hasUnseen: ringStateOf(stories, own) === "unseen" };
}

/** The viewer's ring for `userId`: "none" until the store knows, and for ids that cannot have stories. */
export function useStoryRing(userId: string): RingState {
  const store = useContext(StoriesContext)?.store;
  // Only backend accounts have stories; the template's static profiles carry other ids.
  const watching = store && isBackendHandle(userId) ? store : null;
  const subscribe = useCallback(
    (onChange: () => void) => (watching ? watching.subscribe(userId, onChange) : () => {}),
    [watching, userId],
  );
  const state = useSyncExternalStore(
    subscribe,
    () => watching?.get(userId),
    () => undefined,
  );
  return state ?? "none";
}

export function useStories(): Stories {
  return useContext(StoriesContext)?.actions ?? NO_STORIES;
}

/**
 * Rings and the player behind them, for every avatar in the app. Each avatar asks `useStoryRing`
 * for its owner's ring and the ids asked within a moment leave as one request (`createRingStore`);
 * clicking a ring calls `openStories`, which plays that owner's stories in the one player rendered
 * here. The tray and a profile header play theirs in their own players and report back through
 * `syncRings` when those close.
 */
export function StoriesProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useSession();
  const viewerId = user?.userId ?? null;
  // An answer is about what this viewer may watch, so a viewer who signs in or out gets a store of
  // their own rather than the last one's rings. None while the session is loading: every page load
  // starts as a guest, and a store made then would ask about every avatar on screen, with the
  // token if there is one, into a store nobody reads once `/me` has answered. `isLoading` only ever
  // goes from true to false, so this never throws a cache away.
  const store = useMemo(
    () => (isLoading ? null : createRingStore({ fetchRings: getStoryRings })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- the viewer is the key, not an input
    [isLoading, viewerId],
  );

  // An avatar asks the store once, when it mounts, and the side-nav lists stay mounted for the
  // whole session: without this their ring would never follow a story that expired, one posted
  // since, or a first answer that failed. The store only re-asks what is stale, and nothing is
  // asked of a page nobody is looking at.
  useEffect(() => {
    if (!store) return;
    const renew = () => {
      if (!document.hidden) store.refresh();
    };
    const timer = setInterval(renew, RING_TTL_MS);
    document.addEventListener("visibilitychange", renew);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", renew);
    };
  }, [store]);

  const [playing, setPlaying] = useState<Playing | null>(null);
  const viewing = playing?.store === store ? playing : null;

  const openStories = useCallback(
    async (author: Author) => {
      if (!store) return false;
      const stories = await getUserStories(author.userId).catch(() => []);
      if (stories.length === 0) {
        store.set(author.userId, "none");
        return false;
      }
      const group = groupOf(author.userId, stories, author.userId === viewerId);
      setPlaying({ store, author, groups: [group], start: firstUnseen(group) });
      return true;
    },
    [store, viewerId],
  );

  const syncRings = useCallback(
    (groups: readonly StoryGroup[]) => {
      if (!store) return;
      for (const group of groups) {
        // The viewer's own ring moves only when they post or delete, and both invalidate it. The
        // group a player was handed before that is stale by the time it closes: setting from it
        // would bring back the ring of a story just deleted, and cancel the question `invalidate`
        // queued.
        if (group.userId === viewerId) continue;
        store.set(group.userId, ringStateOf(group.stories, false));
      }
    },
    [store, viewerId],
  );

  const invalidateOwnRing = useCallback(() => {
    if (store && viewerId) store.invalidate(viewerId);
  }, [store, viewerId]);

  const close = useCallback(() => setPlaying(null), []);

  const markSeen = useCallback(
    (storyId: string) =>
      setPlaying((current) => current && { ...current, groups: markStorySeen(current.groups, storyId) }),
    [],
  );

  const value = useMemo(
    () => ({ store, actions: { openStories, syncRings, invalidateOwnRing } }),
    [store, openStories, syncRings, invalidateOwnRing],
  );

  function reload(author: Author) {
    getUserStories(author.userId)
      .then((stories) =>
        setPlaying((current) => {
          if (current?.author.userId !== author.userId) return current;
          return stories.length === 0
            ? null
            : { ...current, groups: [groupOf(author.userId, stories, author.userId === viewerId)] };
        }),
      )
      .catch(() => {});
  }

  return (
    <StoriesContext.Provider value={value}>
      {children}
      {viewing && (
        <StoryViewer
          key={viewing.author.userId}
          groups={viewing.groups}
          authors={{ [viewing.author.userId]: viewing.author }}
          start={{ group: 0, story: viewing.start }}
          onClose={close}
          onSeen={markSeen}
          onOwnStoryChanged={() => reload(viewing.author)}
          onOwnStoryDeleted={close}
        />
      )}
    </StoriesContext.Provider>
  );
}
