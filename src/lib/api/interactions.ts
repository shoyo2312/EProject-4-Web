"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CommentPageResponse,
  CommentResponse,
  LikeStatusResponse,
  SaveStatusResponse,
  ShareResponse,
  VideoIdPageResponse,
  ViewResponse,
  WatchResponse,
} from "@/lib/api/types";

/**
 * interaction-service. Everything here needs a token: both endpoints are
 * per-viewer, and an anonymous one has no identity to deduplicate or learn from.
 */

/**
 * `POST /interactions/videos/{videoId}/watch` — sent **once**, when a viewing
 * session ends: the card scrolls away, the tab closes, the feed unmounts.
 *
 * This is the training label the ranking model learns from, one row per session.
 * A per-second progress ping would flood the topic with rows describing the same
 * session and teach the model nothing.
 *
 * @param watchedMs time actually played, summed across replays inside the
 *   session — a looping clip reports more than its own length, which is the
 *   point: it says the viewer stayed.
 * @param durationMs the clip's length as the player measured it.
 */
export function recordWatch(
  videoId: string,
  watchedMs: number,
  durationMs: number,
): Promise<WatchResponse> {
  return apiFetch<WatchResponse>(`/interactions/videos/${videoId}/watch`, {
    method: "POST",
    body: { watchedMs: Math.round(watchedMs), durationMs: Math.round(durationMs) },
    auth: "required",
  });
}

/**
 * `POST /interactions/videos/{videoId}/view` — the profile grid's view count.
 *
 * Separate from `recordWatch`: this one is deduplicated per `playId` (one
 * playback = one count, a replay counts again) and moves the counter, the
 * other is one row per session for the ranker. The owner's own view counts,
 * exactly as it does on the live site.
 *
 * @param playId opaque id for this playback, generated client-side once per
 *   session — the backend rejects the request without it.
 */
export function recordView(videoId: string, playId: string): Promise<ViewResponse> {
  return apiFetch<ViewResponse>(`/interactions/videos/${videoId}/view`, {
    method: "POST",
    body: { playId },
    auth: "required",
  });
}

/** `POST /interactions/videos/{videoId}/like`. */
export function likeVideo(videoId: string): Promise<LikeStatusResponse> {
  return apiFetch<LikeStatusResponse>(`/interactions/videos/${videoId}/like`, {
    method: "POST",
    auth: "required",
  });
}

/** `DELETE /interactions/videos/{videoId}/like`. */
export function unlikeVideo(videoId: string): Promise<LikeStatusResponse> {
  return apiFetch<LikeStatusResponse>(`/interactions/videos/${videoId}/like`, {
    method: "DELETE",
    auth: "required",
  });
}

/** `GET /interactions/videos/{videoId}/like-status` — whether the viewer liked it. */
export function getLikeStatus(videoId: string): Promise<LikeStatusResponse> {
  return apiFetch<LikeStatusResponse>(
    `/interactions/videos/${videoId}/like-status`,
    { auth: "required" },
  );
}

/**
 * `GET /interactions/videos/like-status/batch` — one request rather than one
 * per id, same reasoning as `getVideosByIds`: the gateway rate-limits 20
 * req/s per IP and every viewer behind the Next proxy shares it.
 */
export function getLikeStatuses(videoIds: string[]): Promise<LikeStatusResponse[]> {
  if (videoIds.length === 0) return Promise.resolve([]);
  return apiFetch<LikeStatusResponse[]>("/interactions/videos/like-status/batch", {
    auth: "required",
    query: { ids: videoIds.join(",") },
  });
}

/** `POST /interactions/videos/{videoId}/share`. */
export function shareVideo(videoId: string): Promise<ShareResponse> {
  return apiFetch<ShareResponse>(`/interactions/videos/${videoId}/share`, {
    method: "POST",
    auth: "required",
  });
}

/**
 * How many comments one page holds — named so a skeleton can cap itself at
 * what a single fetch can actually return.
 */
export const COMMENT_PAGE_SIZE = 20;

/**
 * `GET /interactions/videos/{videoId}/comments` — cursor paged, newest first.
 * Public: a guest can read comments, just not post one.
 */
export function listComments(
  videoId: string,
  cursor?: string,
  size = COMMENT_PAGE_SIZE,
  signal?: AbortSignal,
): Promise<CommentPageResponse> {
  return apiFetch<CommentPageResponse>(`/interactions/videos/${videoId}/comments`, {
    auth: "optional",
    query: { cursor, size },
    signal,
  });
}

/** `POST /interactions/videos/{videoId}/comments`. */
export function addComment(
  videoId: string,
  content: string,
): Promise<CommentResponse> {
  return apiFetch<CommentResponse>(`/interactions/videos/${videoId}/comments`, {
    method: "POST",
    body: { content },
    auth: "required",
  });
}

/** `DELETE /interactions/videos/{videoId}/comments/{commentId}` — owner only. */
export function deleteComment(
  videoId: string,
  commentId: string,
): Promise<void> {
  return apiFetch<void>(
    `/interactions/videos/${videoId}/comments/${commentId}`,
    { method: "DELETE", auth: "required" },
  );
}

/** `POST /interactions/videos/{videoId}/save` — add to favourites. Idempotent. */
export function saveVideo(videoId: string): Promise<SaveStatusResponse> {
  return apiFetch<SaveStatusResponse>(`/interactions/videos/${videoId}/save`, {
    method: "POST",
    auth: "required",
  });
}

/** `DELETE /interactions/videos/{videoId}/save`. Idempotent. */
export function unsaveVideo(videoId: string): Promise<SaveStatusResponse> {
  return apiFetch<SaveStatusResponse>(`/interactions/videos/${videoId}/save`, {
    method: "DELETE",
    auth: "required",
  });
}

/**
 * `GET /interactions/videos/{videoId}/save-status`.
 *
 * Authenticated even for reading, unlike like-status: a save is private to the
 * viewer, so there is no anonymous answer and no public count to show.
 */
export function getSaveStatus(videoId: string): Promise<SaveStatusResponse> {
  return apiFetch<SaveStatusResponse>(
    `/interactions/videos/${videoId}/save-status`,
    { auth: "required" },
  );
}

/**
 * `GET /interactions/users/me/saves` — cursor paged.
 *
 * Only "me": likes and saves are private, and interaction-service exposes no
 * other user's list at all.
 */
export function listSavedVideos(
  cursor?: string,
  size = 50,
  signal?: AbortSignal,
): Promise<VideoIdPageResponse> {
  return apiFetch<VideoIdPageResponse>("/interactions/users/me/saves", {
    auth: "required",
    query: { cursor, size },
    signal,
  });
}

/** `GET /interactions/users/me/likes` — cursor paged, same shape as the saves list. */
export function listLikedVideos(
  cursor?: string,
  size = 50,
  signal?: AbortSignal,
): Promise<VideoIdPageResponse> {
  return apiFetch<VideoIdPageResponse>("/interactions/users/me/likes", {
    auth: "required",
    query: { cursor, size },
    signal,
  });
}
