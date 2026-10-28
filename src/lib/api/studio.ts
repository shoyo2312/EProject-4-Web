"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CommentPageResponse,
  CreatorOverviewResponse,
  CreatorVideoDetail,
  CreatorVideoSort,
  CreatorVideoStats,
  CreatorViewersResponse,
  PageResponse,
  StudioPostSort,
  VideoResponse,
  VideoStatus,
  VideoVisibility,
} from "@/lib/api/types";

/**
 * TikTok Studio. Every call here is about the signed-in creator and nobody
 * else — none of them takes a user id — so they all need the token.
 *
 * `days` is the window Studio's picker offers (7, 28, 60, 365): calendar days
 * in Vietnam's zone ending today, today included.
 */

/** `GET /api/v1/analytics/creator/overview` — the five metrics, compared with the window before. */
export function getCreatorOverview(days: number, signal?: AbortSignal): Promise<CreatorOverviewResponse> {
  return apiFetch<CreatorOverviewResponse>("/analytics/creator/overview", {
    auth: "required",
    query: { days },
    signal,
  });
}

/** `GET /api/v1/analytics/creator/videos/top` — only videos with activity in the window. */
export function getCreatorTopVideos(
  days: number,
  sort: CreatorVideoSort,
  limit = 10,
  signal?: AbortSignal,
): Promise<CreatorVideoStats[]> {
  return apiFetch<CreatorVideoStats[]>("/analytics/creator/videos/top", {
    auth: "required",
    query: { days, sort, limit },
    signal,
  });
}

/** `GET /api/v1/analytics/creator/videos/{videoId}` — `VIDEO_NOT_FOUND` for anyone else's video. */
export function getCreatorVideo(
  videoId: string,
  days: number,
  signal?: AbortSignal,
): Promise<CreatorVideoDetail> {
  return apiFetch<CreatorVideoDetail>(`/analytics/creator/videos/${videoId}`, {
    auth: "required",
    query: { days },
    signal,
  });
}

/** `GET /api/v1/analytics/creator/viewers`. */
export function getCreatorViewers(days: number, signal?: AbortSignal): Promise<CreatorViewersResponse> {
  return apiFetch<CreatorViewersResponse>("/analytics/creator/viewers", {
    auth: "required",
    query: { days },
    signal,
  });
}

export interface StudioPostQuery {
  status?: VideoStatus;
  visibility?: VideoVisibility;
  q?: string;
  sort?: StudioPostSort;
  page?: number;
  size?: number;
}

/**
 * `GET /api/v1/videos/me` — the Posts table: the caller's own videos in every
 * status but deleted, offset paged like the profile grid.
 */
export function listStudioPosts(
  query: StudioPostQuery = {},
  signal?: AbortSignal,
): Promise<PageResponse<VideoResponse>> {
  const { page = 0, size = 20, ...filters } = query;
  return apiFetch<PageResponse<VideoResponse>>("/videos/me", {
    auth: "required",
    query: { ...filters, q: filters.q?.trim() || undefined, page, size },
    signal,
  });
}

export interface InboxQuery {
  videoId?: string;
  status?: "VISIBLE" | "HELD";
  q?: string;
  /** ISO instant, inclusive. */
  from?: string;
  /** ISO instant, exclusive. */
  to?: string;
}

/**
 * `GET /api/v1/interactions/users/me/comments` — what others said on any of
 * the caller's videos, newest first, held ones marked `HELD`.
 *
 * A cursor belongs to the filters it was issued under, so send the same ones
 * with it. A filtered page can come back short, or empty, with `hasMore` still
 * true: keep following `nextCursor`.
 */
export function listInboxComments(
  query: InboxQuery,
  cursor?: string,
  size = 20,
  signal?: AbortSignal,
): Promise<CommentPageResponse> {
  return apiFetch<CommentPageResponse>("/interactions/users/me/comments", {
    auth: "required",
    query: { ...query, q: query.q?.trim() || undefined, cursor, size },
    signal,
  });
}
