import type { ConversationResponse } from "@/lib/api/conversations";

/**
 * The floating chat's own state: which thread is open as a panel, which ones the viewer opened and
 * minimised (they stay as bubbles even with nothing unread), and which ones they closed.
 */
export interface DockState {
  expandedId: string | null;
  pinned: string[];
  /** Conversation id -> its `lastMessageAt` when closed; a newer message brings the bubble back. */
  dismissed: Record<string, string>;
}

export const EMPTY_DOCK: DockState = { expandedId: null, pinned: [], dismissed: {} };

export function openThread(state: DockState, id: string): DockState {
  const { [id]: _dropped, ...dismissed } = state.dismissed;
  void _dropped;
  return {
    expandedId: id,
    pinned: state.pinned.includes(id) ? state.pinned : [...state.pinned, id],
    dismissed,
  };
}

export function minimizeThread(state: DockState): DockState {
  return state.expandedId === null ? state : { ...state, expandedId: null };
}

export function closeThread(state: DockState, id: string, lastMessageAt: string | null): DockState {
  return {
    expandedId: state.expandedId === id ? null : state.expandedId,
    pinned: state.pinned.filter((pinned) => pinned !== id),
    dismissed: { ...state.dismissed, [id]: lastMessageAt ?? new Date().toISOString() },
  };
}

/**
 * The conversations that have something in the dock, newest message first: the open one, the ones
 * the viewer minimised, and any with unread messages — unless the viewer closed them and nothing has
 * arrived since.
 *
 * Ordered here, by `lastMessageAt`, and not taken from `conversations`: that list is in the inbox's
 * order, where a pinned chat sits above newer ones. The input is left as it is. Ties go to the larger id.
 *
 * A muted conversation never raises a bubble by itself: unread messages are there to be read in the
 * inbox, not to pop up. One the viewer opened (expanded or minimised) stays, muted or not.
 */
export function dockConversations(
  conversations: readonly ConversationResponse[],
  unread: Readonly<Record<string, number>>,
  state: DockState,
  isMuted: (conversation: ConversationResponse) => boolean = () => false,
): ConversationResponse[] {
  const eligible = conversations.filter((conversation) => {
    if (conversation.id === state.expandedId || state.pinned.includes(conversation.id)) return true;
    if (isMuted(conversation)) return false;
    if (!(unread[conversation.id] > 0)) return false;
    const closedAt = state.dismissed[conversation.id];
    if (!closedAt) return true;
    return (
      conversation.lastMessageAt !== null &&
      Date.parse(conversation.lastMessageAt) > Date.parse(closedAt)
    );
  });
  const at = (conversation: ConversationResponse) =>
    conversation.lastMessageAt ? Date.parse(conversation.lastMessageAt) : Number.NEGATIVE_INFINITY;
  return eligible.sort((a, b) => {
    const recent = at(b) - at(a);
    if (recent !== 0 && Number.isFinite(recent)) return recent;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Round avatars shown at once; the rest fold into a "+N" that opens the inbox. */
export const MAX_BUBBLES = 3;

/**
 * Splits the dock into the open panel and its bubbles. The open conversation is a panel, not a
 * bubble, so it takes no one of the three places; the bubbles are the newest ones (the input is
 * newest first), and `hidden` is how many more there are.
 */
export function splitDock(
  items: readonly ConversationResponse[],
  expandedId: string | null,
): { expanded: ConversationResponse | undefined; shown: ConversationResponse[]; hidden: number } {
  const bubbles = items.filter((item) => item.id !== expandedId);
  return {
    expanded: items.find((item) => item.id === expandedId),
    shown: bubbles.slice(0, MAX_BUBBLES),
    hidden: Math.max(0, bubbles.length - MAX_BUBBLES),
  };
}
