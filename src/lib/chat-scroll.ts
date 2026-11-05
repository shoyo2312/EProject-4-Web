import type { MessageResponse } from "@/lib/api/conversations";

/** Within this many pixels of the bottom the reader is "following": a new message scrolls into view by itself. */
export const STICK_PX = 80;

/**
 * Within this many pixels the newest message is actually on screen. This is the stricter test: it
 * hides the jump button, clears "new messages" and lets a thread be marked read. Looser than a
 * pixel because of sub-pixel scroll positions, tighter than {@link STICK_PX} because a message a
 * few lines tall must not count as seen while half of it is still below the fold.
 */
export const BOTTOM_PX = 24;

export interface ScrollMetrics {
  scrollHeight: number;
  scrollTop: number;
  clientHeight: number;
}

/** Pixels of content below the visible area; zero or less when everything fits. */
export function distanceFromBottom(metrics: ScrollMetrics): number {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight;
}

export function isAtBottom(metrics: ScrollMetrics, within = BOTTOM_PX): boolean {
  return distanceFromBottom(metrics) <= within;
}

export type JumpButtonKind = "none" | "arrow" | "avatar";

/**
 * What the floating button looks like. It is a property of this viewing of the thread — where the
 * reader is, and which messages arrived while they were elsewhere — never of the app-wide unread count.
 */
export function jumpButtonKind(atBottom: boolean, unseenCount: number): JumpButtonKind {
  if (atBottom) return "none";
  return unseenCount > 0 ? "avatar" : "arrow";
}

/**
 * The messages that came after `previousLastId` in an oldest-first list. Empty when that message
 * is no longer in the list (the thread was replaced) or nothing came after it, so older history
 * prepended above and a frame delivered twice are never mistaken for something new.
 */
export function appendedAfter(
  messages: readonly MessageResponse[],
  previousLastId: string,
): MessageResponse[] {
  const index = messages.findIndex((message) => message.id === previousLastId);
  return index === -1 ? [] : messages.slice(index + 1);
}

/**
 * Of the messages that were appended, those that arrived live in this open thread — the only ones that
 * animate. A page fetched after a reconnect or a tab switch can append messages too, but they are
 * catching up, not arriving.
 */
export function arrivedLive(
  appended: readonly MessageResponse[],
  live: ReadonlySet<string>,
): MessageResponse[] {
  return appended.filter((message) => live.has(message.id));
}

/**
 * Adds the other side's appended messages to the unseen ids, once each. The reader's own messages
 * never count: they scroll the list to the bottom instead.
 */
export function addUnseen(
  unseen: readonly string[],
  appended: readonly MessageResponse[],
  me: string,
): string[] {
  const next = new Set(unseen);
  for (const message of appended) {
    if (message.senderId !== me) next.add(message.id);
  }
  return next.size === unseen.length ? (unseen as string[]) : [...next];
}
