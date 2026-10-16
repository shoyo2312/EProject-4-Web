/**
 * One message on `/topic/videos.{videoId}.comments`. Mirrors
 * `CommentFrame` in chat-service — see that file for field docs. `parentId`
 * is the top-level comment a reply hangs under (already flattened one level
 * deep by interaction-service) and is absent on a top-level comment.
 */
export type CommentRealtimeFrame = {
  type: "comment.created" | "comment.deleted" | "comment.liked";
  videoId: string;
  commentId: string;
  userId?: string;
  content?: string;
  createdAt?: string;
  parentId?: string;
  replyToUserId?: string;
  likeCount?: number;
};
/**
 * Matches interaction-service `AddCommentRequest` `@MaxCodePoints(150)` —
 * code points, so measure with `codePointLength`, not `.length`.
 */
export const COMMENT_MAX_LENGTH = 150;
/**
 * A post that did not go through: its text goes back in the box, and Post stays
 * off for `retryAfter` seconds — set only by a rate limit, the one refusal that
 * says when the next post will be taken.
 */
export interface PostFailure {
  retryAfter: number | null;
  /**
   * The rules turned this text down. Post stays off until it is edited: sent
   * again unchanged it is refused again, and each refusal is a strike toward a
   * commenting restriction.
   */
  refused: boolean;
}
/** Which comment thread the composer is aimed at, if any. */
export interface ReplyTarget {
  /** Top-level comment the reply gets appended to (TikTok nests one level). */
  parentId: string;
  /** Handle shown in the composer placeholder — may be a reply's author. */
  username: string;
  /**
   * Id of the comment whose "Reply" was actually clicked — sent to the backend, which flattens a
   * reply-to-a-reply onto its top-level ancestor and derives `replyToUserId` from it. Equals
   * `parentId` when replying straight to a top-level comment.
   */
  replyToCommentId?: string;
  /** Name for the "author › replyToName" label — set only when replying to another reply. */
  replyToName?: string;
}
