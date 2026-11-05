/**
 * Which conversations are being looked at right now: a thread mounted on screen with its newest
 * message in view. The unread counter asks before counting a live message — one that lands in a
 * thread the viewer is reading is read, not unread — and a thread asks before it tells the server
 * so. Module state rather than context because the counter lives above every route and the
 * threads below it, and neither renders the other.
 *
 * A thread only counts while the tab is shown and the window has focus.
 */
const viewing = new Set<string>();

export function setViewing(conversationId: string, on: boolean): void {
  if (on) viewing.add(conversationId);
  else viewing.delete(conversationId);
}

export function isViewing(conversationId: string): boolean {
  return (
    viewing.has(conversationId) &&
    document.visibilityState === "visible" &&
    document.hasFocus()
  );
}

/**
 * The tab is shown and the window has focus — what "looking at the screen" needs besides the thread
 * being open. Nothing else about the conversation: a thread scrolled up through history is still looked
 * at, just not at its newest message, and which messages are in view is the list's own answer.
 */
export function isWindowActive(): boolean {
  return document.visibilityState === "visible" && document.hasFocus();
}
