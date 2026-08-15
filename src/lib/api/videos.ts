"use client";

import { apiFetch } from "@/lib/api/client";
import type {
  CreateVideoRequest,
  PageResponse,
  VideoResponse,
} from "@/lib/api/types";

/**
 * video-service. Reads are public, writes need a token — but a token still
 * changes what a read returns, so `auth: "optional"` (send it when we have it)
 * is right on every GET here, not `"none"`.
 */

/** `GET /api/v1/videos/feed` — PUBLISHED + PUBLIC only, newest first. */
export function getFeed(
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<PageResponse<VideoResponse>> {
  return apiFetch<PageResponse<VideoResponse>>("/videos/feed", {
    auth: "optional",
    query: { page, size },
    signal,
  });
}

/**
 * `GET /api/v1/videos/{videoId}`. Send the token: without it the owner cannot
 * see their own PROCESSING/PRIVATE video and gets a 404 that looks like the
 * video vanished.
 */
export function getVideo(
  videoId: string,
  signal?: AbortSignal,
): Promise<VideoResponse> {
  return apiFetch<VideoResponse>(`/videos/${videoId}`, {
    auth: "optional",
    signal,
  });
}

/**
 * `GET /api/v1/videos/users/{userId}`. Called for yourself it returns
 * everything including PROCESSING/PRIVATE/FAILED — that is the "My videos"
 * screen. An unknown userId is an empty page, never an error.
 */
export function getUserVideos(
  userId: string,
  page = 0,
  size = 20,
  signal?: AbortSignal,
): Promise<PageResponse<VideoResponse>> {
  return apiFetch<PageResponse<VideoResponse>>(`/videos/users/${userId}`, {
    auth: "optional",
    query: { page, size },
    signal,
  });
}

/**
 * `POST /api/v1/videos` — 201, but the video is NOT watchable yet. It comes
 * back `PROCESSING` with no `hlsUrl` and is absent from the feed until
 * transcoding finishes; poll with `pollUntilReady`.
 */
export function createVideo(input: CreateVideoRequest): Promise<VideoResponse> {
  return apiFetch<VideoResponse>("/videos", {
    method: "POST",
    body: input,
    auth: "required",
  });
}

/** `DELETE /api/v1/videos/{videoId}` — soft delete, one way, owner only. */
export function deleteVideo(videoId: string): Promise<void> {
  return apiFetch<void>(`/videos/${videoId}`, {
    method: "DELETE",
    auth: "required",
  });
}

/** 2s, 5s, then 10s apart — backing off because the gateway caps 20 req/s per IP. */
const POLL_DELAYS_MS = [2_000, 5_000, 10_000];
const POLL_TIMEOUT_MS = 5 * 60_000;

/**
 * Polls a freshly created video until it is watchable. Resolves with the last
 * response seen: `PUBLISHED` on success, `FAILED` when transcoding broke, or
 * whatever it was still stuck on when the five-minute budget ran out — the
 * caller then shows "still processing, check back later" rather than an error.
 */
export async function pollUntilReady(
  videoId: string,
  onUpdate?: (video: VideoResponse) => void,
): Promise<VideoResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;
  let latest = await getVideo(videoId);
  onUpdate?.(latest);

  while (
    latest.status === "PROCESSING" &&
    Date.now() < deadline
  ) {
    const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
    await new Promise((resolve) => setTimeout(resolve, delay));
    attempt += 1;

    latest = await getVideo(videoId);
    onUpdate?.(latest);
  }

  return latest;
}
