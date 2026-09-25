import type { CommentRestriction } from "@/lib/api/types";

const COMMENTS_OFF = "This creator has turned off commenting";

/**
 * What stands in for the comment box, or null when the viewer may comment.
 *
 * An account that accepts comments from no one reads exactly like the video's
 * own switch being off — for everyone, the owner included, it is. Friends-only
 * says so about the viewer instead, since the thread is still open to others.
 */
export function commentLockMessage(
  commentsDisabled: boolean,
  restriction: CommentRestriction | null,
): string | null {
  if (commentsDisabled) return COMMENTS_OFF;
  switch (restriction) {
    case "COMMENTS_DISABLED":
    case "NO_ONE":
      return COMMENTS_OFF;
    case "FRIENDS_ONLY":
      return "You cannot comment on this video";
    case null:
      return null;
  }
}
