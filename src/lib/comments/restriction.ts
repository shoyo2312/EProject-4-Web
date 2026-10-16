import type { CommentRestriction } from "@/lib/api/types";
import { formatDateTime } from "@/lib/format";

const COMMENTS_OFF = "This creator has turned off commenting";

/**
 * What stands in for the comment box, or null when the viewer may comment.
 *
 * An account that accepts comments from no one reads exactly like the video's
 * own switch being off — for everyone, the owner included, it is. Friends-only
 * says so about the viewer instead, since the thread is still open to others.
 * So does a restriction for repeated violations, which follows the viewer onto
 * every video until `restrictedUntil` (epoch ms).
 */
export function commentLockMessage(
  commentsDisabled: boolean,
  restriction: CommentRestriction | null,
  restrictedUntil: number | null = null,
): string | null {
  if (commentsDisabled) return COMMENTS_OFF;
  switch (restriction) {
    case "COMMENTS_DISABLED":
    case "NO_ONE":
      return COMMENTS_OFF;
    case "FRIENDS_ONLY":
      return "You cannot comment on this video";
    case "COMMENTING_RESTRICTED":
      return restrictedUntil === null
        ? "You can’t comment right now because of repeated violations."
        : `You can’t comment until ${formatDateTime(new Date(restrictedUntil))} because of repeated violations.`;
    case null:
      return null;
  }
}
