"use client";

import { resolveAuthor, resolveAuthors } from "@/lib/api/authors";
import { COMMENT_FIRST_PAGE_SIZE, listComments } from "@/lib/api/interactions";
import type { CommentResponse } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import type { Comment } from "@/types/tiktok";

/** A fetched comment paired with the id it hangs off — `null` for a top-level comment. */
export type CommentEntry = { ui: Comment; parentId: string | null };

/** One fetched page, already in UI shape, plus where the next one starts. */
export interface CommentPage {
  entries: CommentEntry[];
  cursor: string | null;
  hasMore: boolean;
}

/** interaction-service's flat DTO → the UI's `Comment`, author resolved by id. */
export async function toUiComment(raw: CommentResponse): Promise<CommentEntry> {
  return {
    ui: {
      id: raw.commentId,
      author: await resolveAuthor(raw.userId),
      text: raw.content,
      timestamp: formatRelativeTime(raw.createdAt),
      likes: raw.likeCount,
      likedByMe: raw.likedByMe,
      replyCount: raw.replyCount,
      replyToName: raw.replyToUserId
        ? (await resolveAuthor(raw.replyToUserId)).nickname
        : undefined,
    },
    parentId: raw.parentId,
  };
}

/**
 * A whole page at once. Priming the author cache with one batched request
 * first is what makes this cheap: `toUiComment` awaits `resolveAuthor` per
 * comment (and per `replyToUserId`), so without the prime a 20-comment page by
 * 20 people costs 20 round trips to user-service instead of one.
 */
export async function toUiComments(
  raw: CommentResponse[],
): Promise<CommentEntry[]> {
  await resolveAuthors(
    raw.flatMap((item) =>
      item.replyToUserId ? [item.userId, item.replyToUserId] : [item.userId],
    ),
  );
  return Promise.all(raw.map(toUiComment));
}

/** In flight or done, keyed by video id. */
const pages = new Map<string, Promise<CommentPage>>();
/** The same pages once settled, so a remount can paint without awaiting. */
const settled = new Map<string, CommentPage>();

/**
 * First page of comments for a video, fetched at most once per tab.
 *
 * The panel is keyed by video id, so scrolling the feed unmounts and remounts
 * it; without this every pass over the same video re-fetched its comments and
 * flashed a skeleton. A failed fetch drops its entry so the next open retries.
 *
 * `refresh` refetches anyway, for an open that has to see other people's
 * comments rather than only this tab's — nothing expires a cached page on its
 * own, and only mutations this tab witnessed drop it. The settled copy is left
 * in place until the new one lands, so `peekCommentPage` still paints.
 */
export function loadFirstCommentPage(
  videoId: string,
  refresh = false,
): Promise<CommentPage> {
  const cached = pages.get(videoId);
  if (cached && !refresh) return cached;

  const pending = listComments(videoId, undefined, COMMENT_FIRST_PAGE_SIZE)
    .then(async (page): Promise<CommentPage> => {
      const result = {
        entries: await toUiComments(page.items),
        cursor: page.nextCursor,
        hasMore: page.hasMore,
      };
      settled.set(videoId, result);
      return result;
    })
    .catch((error: unknown) => {
      pages.delete(videoId);
      throw error;
    });

  pages.set(videoId, pending);
  return pending;
}

/** The cached page if it has already arrived — lets a remount skip the skeleton. */
export function peekCommentPage(videoId: string): CommentPage | undefined {
  return settled.get(videoId);
}

/**
 * Drops a video's cached page after its comments change under us — someone
 * posted, someone deleted, or a realtime frame landed.
 *
 * ponytail: invalidate rather than patch. Keeping the cache in step with every
 * local mutation means duplicating the panel's whole merge/reply tree here; a
 * dropped entry just costs one refetch on the next open, which is exactly what
 * happened before this cache existed. Patch it only if that refetch shows up
 * in a profile.
 */
export function invalidateCommentPage(videoId: string): void {
  pages.delete(videoId);
  settled.delete(videoId);
}

/**
 * Called on sign-in/sign-out beside `clearAuthorCache`: `likedByMe` is per
 * viewer, so another account must never inherit these rows.
 */
export function clearCommentCache(): void {
  pages.clear();
  settled.clear();
}
