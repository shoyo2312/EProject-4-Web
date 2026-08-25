"use client";

import { unknownAuthor, videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import type { VideoResponse } from "@/lib/api/types";
import type { FeedVideo } from "@/types/tiktok";

/**
 * Backend videos → feed cards, resolving each author's profile alongside and
 * dropping anything the viewer has already been shown.
 *
 * `seen` is the caller's own set and is mutated here: both feeds page forever,
 * and the ranked and chronological sources of "For You" draw from one library,
 * so the same video routinely arrives twice. Shared by both feed hooks because
 * a second copy of this is a second place for the author fallback to drift.
 */
export async function toFeedCards(
  rows: VideoResponse[],
  seen: Set<string>,
): Promise<FeedVideo[]> {
  const unseen = rows.filter((video) => !seen.has(video.id));
  if (unseen.length === 0) return [];

  const authors = await resolveAuthors(unseen.map((video) => video.userId));
  return unseen.map((video) => {
    seen.add(video.id);
    // resolveAuthors already substitutes a placeholder for a profile it could
    // not read, so the fallback here only covers an id it never saw at all.
    return videoToFeedVideo(
      video,
      authors.get(video.userId) ?? unknownAuthor(video.userId),
    );
  });
}
