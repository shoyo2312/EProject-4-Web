import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";

/**
 * chat-service answers "is this thread unread" (`hasUnread`) but never "how many", so the count
 * is kept here: the ids of the other side's messages that arrived while the thread was not being
 * read. Ids, not a number, so the same frame arriving twice — a re-delivery, a reconnect, the
 * resync that follows it — can never count twice.
 */
export interface UnreadEntry {
  ids: string[];
  /** The conversation's `lastMessageAt` when `ids` was last made to match the server. */
  lastAt: string | null;
}

export interface UnreadState {
  unread: Record<string, UnreadEntry>;
  /**
   * Per conversation, the `sentAt` of the newest message the viewer has read. A resync after the
   * tab was closed counts only what came after it, instead of the whole run from the other side.
   */
  readThrough: Record<string, string>;
}

export const EMPTY_UNREAD: UnreadState = { unread: {}, readThrough: {} };

/** More than this per thread is shown as "99+" anyway, and chat-service pages at 100. */
const MAX_IDS = 100;
const BADGE_CAP = 99;

export function unreadTotal(state: UnreadState): number {
  return Object.values(state.unread).reduce((sum, entry) => sum + entry.ids.length, 0);
}

/** The number on the badge: nothing at zero, "99+" past 99. */
export function badgeLabel(total: number): string | undefined {
  if (total <= 0) return undefined;
  return total > BADGE_CAP ? `${BADGE_CAP}+` : String(total);
}

/** A live message from the other side that nobody was reading. Idempotent per message id. */
export function addUnread(state: UnreadState, message: MessageResponse): UnreadState {
  const entry = state.unread[message.conversationId];
  if (entry?.ids.includes(message.id)) return state;
  const ids = [...(entry?.ids ?? []), message.id].slice(-MAX_IDS);
  return {
    ...state,
    unread: { ...state.unread, [message.conversationId]: { ids, lastAt: message.sentAt } },
  };
}

/** The thread was read up to `readAt` (the newest message on screen): zero it and remember how far. */
export function markConversationReadLocally(
  state: UnreadState,
  conversationId: string,
  readAt: string,
): UnreadState {
  const { [conversationId]: _dropped, ...unread } = state.unread;
  void _dropped;
  const known = state.readThrough[conversationId];
  const readThrough =
    known && Date.parse(known) >= Date.parse(readAt) ? known : readAt;
  return { unread, readThrough: { ...state.readThrough, [conversationId]: readThrough } };
}

/**
 * The conversation was deleted from this account: its unread run and read mark go with it, here and
 * in what is saved on the device. A later message starts a new run.
 */
export function dropConversation(state: UnreadState, conversationId: string): UnreadState {
  const { [conversationId]: _unread, ...unread } = state.unread;
  const { [conversationId]: _read, ...readThrough } = state.readThrough;
  void _unread;
  void _read;
  return { unread, readThrough };
}

/** The socket and the REST list print the same instant at different precision. */
function sameInstant(a: string | null, b: string | null): boolean {
  if (a === null || b === null) return a === b;
  return Math.trunc(Date.parse(a)) === Math.trunc(Date.parse(b));
}

/** Whether the stored ids already describe this conversation, or its newest messages must be fetched. */
export function needsTail(state: UnreadState, conversation: ConversationResponse): boolean {
  if (!conversation.hasUnread) return false;
  const entry = state.unread[conversation.id];
  return !entry || entry.ids.length === 0 || !sameInstant(entry.lastAt, conversation.lastMessageAt);
}

/**
 * The unread run at the head of a thread: the other side's messages newer than anything the
 * viewer sent (sending marks everything before it read) and than `readThrough`.
 * `newestFirst` is the order the server pages in.
 */
export function unreadTail(
  newestFirst: readonly MessageResponse[],
  me: string,
  readThrough: string | undefined,
): MessageResponse[] {
  const tail: MessageResponse[] = [];
  for (const message of newestFirst) {
    if (message.senderId === me) break;
    if (readThrough && Date.parse(message.sentAt) <= Date.parse(readThrough)) break;
    tail.push(message);
  }
  return tail;
}

/**
 * Brings the state in line with a fresh conversation list. The server decides which threads are
 * unread; `tails` (the newest page of each thread whose ids were stale) decides how many messages
 * that is. A thread the server calls read is dropped, whatever this device believed.
 */
export function reconcile(
  state: UnreadState,
  conversations: readonly ConversationResponse[],
  tails: Readonly<Record<string, readonly MessageResponse[]>>,
  me: string,
): UnreadState {
  const unread: Record<string, UnreadEntry> = {};
  for (const conversation of conversations) {
    if (!conversation.hasUnread) continue;
    const tail = tails[conversation.id];
    if (tail) {
      const ids = unreadTail(tail, me, state.readThrough[conversation.id])
        .map((message) => message.id)
        .reverse()
        .slice(-MAX_IDS);
      // The server says unread but nothing newer than the read mark exists locally: count the
      // newest message rather than show zero for a thread the list marks.
      unread[conversation.id] = {
        ids: ids.length > 0 ? ids : tail[0] ? [tail[0].id] : [],
        lastAt: conversation.lastMessageAt,
      };
    } else if (state.unread[conversation.id]) {
      unread[conversation.id] = state.unread[conversation.id];
    }
  }
  return { unread, readThrough: state.readThrough };
}

const KEY = "nowa.chat-unread.";

export function loadUnread(userId: string): UnreadState {
  try {
    const raw = window.localStorage.getItem(KEY + userId);
    if (!raw) return EMPTY_UNREAD;
    const parsed = JSON.parse(raw) as Partial<UnreadState>;
    if (typeof parsed.unread !== "object" || parsed.unread === null) return EMPTY_UNREAD;
    return { unread: parsed.unread, readThrough: parsed.readThrough ?? {} };
  } catch {
    return EMPTY_UNREAD;
  }
}

export function saveUnread(userId: string, state: UnreadState): void {
  try {
    window.localStorage.setItem(KEY + userId, JSON.stringify(state));
  } catch {
    // Private mode or a full quota: the count is rebuilt from the server on the next sync.
  }
}
