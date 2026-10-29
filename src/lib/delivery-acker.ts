import type { MessageResponse, Receipt } from "@/lib/api/conversations";
import { comparePosition } from "@/lib/chat";

/** A burst of messages is one acknowledgement: it goes out once the burst has been quiet this long. */
export const ACK_DELAY_MS = 300;
/** A failed acknowledgement is retried after this, doubling each time, up to {@link ACK_RETRIES} times. */
export const ACK_RETRY_MS = 4_000;
export const ACK_RETRIES = 5;
/** chat-service takes at most this many ids in one acknowledgement. */
export const ACK_BATCH = 100;
/** How many times in a row a gap is looked for before it is left to the next sync. */
const GAP_FILLS = 2;

interface Held {
  sentAt: string;
}

export interface DeliveryDeps {
  me: string;
  /** Sends the ids; resolves with the viewer's own marks as the server now has them. */
  acknowledge: (conversationId: string, messageIds: string[]) => Promise<Receipt>;
  /** The newest page of a conversation — what a client that was away has to read to hold its messages. */
  fetchNewest: (conversationId: string) => Promise<MessageResponse[]>;
}

/**
 * Tells the server which messages of the other side this client now holds, so the sender can say
 * "received". It does not claim anything it has not read: it names messages it actually has — from a
 * live frame or from a page it fetched — and the server moves the mark only across a run of messages
 * that are all named. When the answer stops short of what was named, something between was never
 * received here: the newest page is read to fill it, and only then is the run named again.
 *
 * One instance belongs to one signed-in account. {@link dispose} cancels every timer and makes any
 * request still in flight a no-op, so signing out or switching accounts cannot send an acknowledgement
 * (or apply an answer) on behalf of the previous one.
 */
export class DeliveryAcker {
  private readonly held = new Map<string, Map<string, Held>>();
  private readonly timers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly attempts = new Map<string, number>();
  private readonly gapFills = new Map<string, number>();
  private readonly covered = new Map<string, { sentAt: string; messageId: string }>();
  private readonly catching = new Set<string>();
  private readonly inFlight = new Set<string>();
  private disposed = false;

  constructor(private readonly deps: DeliveryDeps) {}

  /** Messages this client has received. Its own are not its to acknowledge, and are ignored. */
  hold(conversationId: string, messages: readonly Pick<MessageResponse, "id" | "sentAt" | "senderId">[]): void {
    if (this.disposed) return;
    let added = false;
    for (const message of messages) {
      if (message.senderId === this.deps.me) continue;
      const done = this.covered.get(conversationId);
      if (done && comparePosition({ sentAt: message.sentAt, messageId: message.id }, done) <= 0) continue;
      let ids = this.held.get(conversationId);
      if (!ids) this.held.set(conversationId, (ids = new Map()));
      if (!ids.has(message.id)) {
        ids.set(message.id, { sentAt: message.sentAt });
        added = true;
      }
    }
    if (added) this.schedule(conversationId, ACK_DELAY_MS);
  }

  /**
   * A conversation reports something unread from the other side that this client may not hold (it
   * arrived while it was away): read its newest page, hold what is there, acknowledge it. Skipped when
   * what the server last confirmed already reaches `lastMessageAt`, or when a catch-up is running.
   */
  async catchUp(conversationId: string, lastMessageAt: string | null): Promise<void> {
    if (this.disposed || this.catching.has(conversationId)) return;
    const done = this.covered.get(conversationId);
    if (done && lastMessageAt && Date.parse(done.sentAt) >= Date.parse(lastMessageAt)) return;
    this.catching.add(conversationId);
    try {
      const page = await this.deps.fetchNewest(conversationId);
      this.hold(conversationId, page);
    } catch {
      // The next sync asks again.
    } finally {
      this.catching.delete(conversationId);
    }
  }

  dispose(): void {
    this.disposed = true;
    for (const timer of this.timers.values()) clearTimeout(timer);
    this.timers.clear();
    this.held.clear();
    this.inFlight.clear();
  }

  private schedule(conversationId: string, delay: number): void {
    const queued = this.timers.get(conversationId);
    if (queued) clearTimeout(queued);
    this.timers.set(
      conversationId,
      setTimeout(() => {
        this.timers.delete(conversationId);
        void this.flush(conversationId);
      }, delay),
    );
  }

  private async flush(conversationId: string): Promise<void> {
    if (this.disposed || this.inFlight.has(conversationId)) return;
    const ids = this.held.get(conversationId);
    if (!ids || ids.size === 0) return;
    const batch = [...ids.entries()]
      .map(([messageId, held]) => ({ messageId, sentAt: held.sentAt }))
      .sort(comparePosition)
      .slice(0, ACK_BATCH);

    this.inFlight.add(conversationId);
    let receipt: Receipt;
    try {
      receipt = await this.deps.acknowledge(conversationId, batch.map((m) => m.messageId));
    } catch {
      this.inFlight.delete(conversationId);
      if (this.disposed) return;
      const tries = (this.attempts.get(conversationId) ?? 0) + 1;
      this.attempts.set(conversationId, tries);
      if (tries <= ACK_RETRIES) this.schedule(conversationId, ACK_RETRY_MS * 2 ** (tries - 1));
      return;
    }
    this.inFlight.delete(conversationId);
    if (this.disposed) return;
    this.attempts.delete(conversationId);

    const mark = receipt.delivered;
    if (mark) {
      const current = this.covered.get(conversationId);
      if (!current || comparePosition(mark, current) > 0) {
        this.covered.set(conversationId, { sentAt: mark.sentAt, messageId: mark.messageId });
      }
      for (const [messageId, held] of [...ids.entries()]) {
        if (comparePosition({ sentAt: held.sentAt, messageId }, mark) <= 0) ids.delete(messageId);
      }
    }
    if (ids.size === 0) {
      this.held.delete(conversationId);
      this.gapFills.delete(conversationId);
      return;
    }
    // The server stopped short of what was named: a message in between never reached this client.
    const fills = this.gapFills.get(conversationId) ?? 0;
    if (fills >= GAP_FILLS) return;
    this.gapFills.set(conversationId, fills + 1);
    await this.catchUp(conversationId, null);
    this.schedule(conversationId, ACK_DELAY_MS);
  }
}
