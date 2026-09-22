import type { VideoResponse } from "@/lib/api/types";
import type { Author, SuggestedCreator } from "@/types/tiktok";

/**
 * Who to offer a viewer with an empty Following or Friends feed.
 *
 * There is no "suggested users" endpoint anywhere in the backend — user-service
 * only answers about accounts you already name, and recommendation-service
 * ranks videos, not people. So the suggestions are derived from the public
 * feed: the creators posting right now, newest first, one card each. That is
 * real content rather than a mock grid, and it is the closest thing to
 * "discover somebody to follow" the services actually offer.
 *
 * `videos` is expected newest-first (the feed's own order), so the first video
 * a creator appears in is their latest — that is the frame the card covers with.
 */
export function pickSuggestedCreators(
  videos: readonly VideoResponse[],
  authors: ReadonlyMap<string, Author>,
  options: { exclude?: Iterable<string>; limit?: number } = {},
): SuggestedCreator[] {
  const { limit = 12 } = options;
  const skip = new Set(options.exclude ?? []);
  const cards: SuggestedCreator[] = [];

  for (const video of videos) {
    if (cards.length >= limit) break;
    if (skip.has(video.userId)) continue;
    const author = authors.get(video.userId);
    if (!author) continue;

    // One card per creator: seeing the same person three times is worse than a
    // shorter grid, and the feed routinely runs several videos deep per author.
    skip.add(video.userId);

    cards.push({
      id: video.userId,
      author,
      // user-service has no verification concept — see `profileToUserProfile`.
      isVerified: false,
      posterUrl: video.thumbnailUrl ?? "",
      videoUrl: video.hlsUrl ?? "",
      isFollowing: false,
    });
  }

  return cards;
}
