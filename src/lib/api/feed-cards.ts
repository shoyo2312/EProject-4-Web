"use client";

import { unknownAuthor, videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { getVideoCounts } from "@/lib/api/interactions";
import type { InteractionCountResponse, VideoResponse } from "@/lib/api/types";
import type { FeedVideo } from "@/types/tiktok";

/**
 * Backend videos → feed cards, resolving each author's profile and the share
 * and save counts alongside, and dropping anything the viewer has already been
 * shown.
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
  // Claimed before the await, not after: a second call landing while this one
  // resolves authors (a page and a just-published video, say) would otherwise
  // pass the same id and render two cards under one React key.
  const unseen: VideoResponse[] = [];
  for (const video of rows) {
    if (seen.has(video.id)) continue;
    seen.add(video.id);
    unseen.push(video);
  }
  if (unseen.length === 0) return [];

  let authors: Awaited<ReturnType<typeof resolveAuthors>>;
  let counts: InteractionCountResponse[];
  try {
    [authors, counts] = await Promise.all([
      resolveAuthors(unseen.map((video) => video.userId)),
      // Only the share and save figures ride on this, so failing costs those
      // two numbers and not the cards.
      getVideoCounts(unseen.map((video) => video.id)).catch(() => []),
    ]);
  } catch (cause) {
    // Never shown, so a retry must be allowed to show them.
    for (const video of unseen) seen.delete(video.id);
    throw cause;
  }
  const countsById = new Map(counts.map((row) => [row.videoId, row]));
  return unseen.map((video) =>
    // resolveAuthors already substitutes a placeholder for a profile it could
    // not read, so the fallback here only covers an id it never saw at all.
    videoToFeedVideo(video, authors.get(video.userId) ?? unknownAuthor(video.userId), {
      counts: countsById.get(video.id),
    }),
  );
}
