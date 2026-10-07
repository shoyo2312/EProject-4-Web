import type { LikeStatusResponse } from "@/lib/api/types";

/**
 * What the server has told this viewer about some videos' likes, by video id.
 * An id missing from a map has not been heard about yet.
 */
export interface LikeLedger {
  /** Whether the viewer's like is on, as the server last confirmed it. */
  liked: Readonly<Record<string, boolean>>;
  /** The latest like count — from a status batch, a like reply or a counts frame. */
  counts: Readonly<Record<string, number>>;
}

export const EMPTY_LEDGER: LikeLedger = { liked: {}, counts: {} };

/**
 * Folds a like-status batch in without overwriting anything already heard.
 * The batch went out when the videos first appeared, so a like reply or a
 * counts frame that beat it back describes a later state than it does.
 */
export function seedLikes(
  ledger: LikeLedger,
  statuses: readonly LikeStatusResponse[],
): LikeLedger {
  const liked = { ...ledger.liked };
  const counts = { ...ledger.counts };
  for (const status of statuses) {
    liked[status.videoId] ??= status.liked;
    counts[status.videoId] ??= status.likeCount;
  }
  return { liked, counts };
}

/** A like or unlike reply — newer than anything heard before it. */
export function confirmLike(ledger: LikeLedger, status: LikeStatusResponse): LikeLedger {
  return {
    liked: { ...ledger.liked, [status.videoId]: status.liked },
    counts: { ...ledger.counts, [status.videoId]: status.likeCount },
  };
}

/** A counts frame's like tally. Returns `ledger` itself when nothing moved. */
export function withLikeCount(
  ledger: LikeLedger,
  videoId: string,
  likeCount: number,
): LikeLedger {
  if (ledger.counts[videoId] === likeCount) return ledger;
  return { ...ledger, counts: { ...ledger.counts, [videoId]: likeCount } };
}

/**
 * The count beside a heart: the server's, plus the viewer's own tap the server
 * has not confirmed yet. The server's count already includes a confirmed like,
 * so a heart that agrees with the server adds nothing — adding one showed 2
 * for a video a single account had liked.
 */
export function displayLikeCount(
  serverCount: number,
  liked: boolean,
  serverLiked: boolean,
): number {
  if (liked === serverLiked) return serverCount;
  return serverCount + (liked ? 1 : -1);
}
