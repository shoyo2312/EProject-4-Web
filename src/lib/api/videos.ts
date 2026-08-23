"use client";

import { apiFetch } from "@/lib/api/client";
import { ApiError } from "@/lib/api/errors";
import type {
  CreateVideoRequest,
  UploadUrlRequest,
  UploadUrlResponse,
  CursorPage,
  PageResponse,
  VideoResponse,
} from "@/lib/api/types";

/**
 * video-service. Reads are public, writes need a token — but a token still
 * changes what a read returns, so `auth: "optional"` (send it when we have it)
 * is right on every GET here, not `"none"`.
 */

/**
 * `GET /api/v1/videos/feed` — PUBLISHED + PUBLIC only, newest first, **cursor
 * paged**. Pass the previous response's `nextCursor` to continue and stop when
 * it comes back null; there is no page number and no total to count against.
 *
 * The distinction matters because the feed grows at the head: with offsets, a
 * video seen on page 0 slides down into page 1 and gets served twice. A cursor
 * is positioned on a video, so newer uploads cannot shift it.
 */
export function getFeed(
  cursor?: string,
  size = 20,
  signal?: AbortSignal,
): Promise<CursorPage<VideoResponse>> {
  return apiFetch<CursorPage<VideoResponse>>("/videos/feed", {
    auth: "optional",
    query: { cursor, size },
    signal,
  });
}

/**
 * `GET /api/v1/videos/batch?ids=…` — hydrates a ranking in one round trip, in
 * the order asked.
 *
 * One request rather than one per id on purpose: the gateway rate-limits 20
 * req/s per **IP**, and behind the Next proxy every viewer shares one, so a
 * twenty-id feed fetched individually spends the whole budget on one scroll.
 *
 * Ids that resolve to nothing the viewer may see are **absent** from the reply
 * rather than failing it, so the result can be shorter than the input — a feed
 * naming a video deleted seconds ago is the normal case here.
 */
export function getVideosByIds(
  ids: string[],
  signal?: AbortSignal,
): Promise<VideoResponse[]> {
  if (ids.length === 0) return Promise.resolve([]);
  return apiFetch<VideoResponse[]>("/videos/batch", {
    auth: "optional",
    query: { ids: ids.join(",") },
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

/** Video MIME types the backend presigns for, and what to put in `accept`. */
export const ACCEPTED_UPLOAD_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

/**
 * `POST /api/v1/videos/upload-url` — step one of posting a video.
 *
 * The file goes straight from the browser to object storage with the presigned
 * PUT this returns; nothing but the URL passes through the API. Step two is
 * `uploadToStorage`, step three is `createVideo` with the `fileUrl` from here.
 */
export function createUploadUrl(
  input: UploadUrlRequest,
): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>("/videos/upload-url", {
    method: "POST",
    body: input,
    auth: "required",
  });
}

/**
 * PUTs the file at a presigned URL, reporting progress 0–1.
 *
 * XHR rather than `fetch` because only XHR reports **upload** progress, and a
 * multi-hundred-megabyte upload with no progress bar reads as a frozen page.
 * The presigned signature covers the key and expiry, not headers, so sending
 * `Content-Type` is safe — storage keeps it for media-worker to read back.
 */
export function uploadToStorage(
  uploadUrl: string,
  file: File,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", file.type);

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress?.(1);
        resolve();
        return;
      }
      // Storage answers in XML, and its wording ("NoSuchBucket") is for us, not
      // the uploader — the status is all the caller needs to tell them.
      reject(new ApiError(xhr.status, "UPLOAD_FAILED", "Upload failed"));
    };
    xhr.onerror = () =>
      reject(new ApiError(0, "NETWORK_ERROR", "Cannot reach the storage host"));
    xhr.onabort = () => reject(new DOMException("Aborted", "AbortError"));

    // Reject rather than return: a promise settled by nobody leaves the caller
    // showing "uploading" for as long as the page is open.
    if (signal?.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(file);
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
  signal?: AbortSignal,
): Promise<VideoResponse> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let attempt = 0;
  let latest = await getVideo(videoId, signal);
  onUpdate?.(latest);

  while (
    latest.status === "PROCESSING" &&
    Date.now() < deadline &&
    !signal?.aborted
  ) {
    const delay = POLL_DELAYS_MS[Math.min(attempt, POLL_DELAYS_MS.length - 1)];
    await sleep(delay, signal);
    if (signal?.aborted) break;
    attempt += 1;

    try {
      latest = await getVideo(videoId, signal);
    } catch {
      // A blip on one poll says nothing about the video, which is transcoding
      // regardless. Throwing here reported a successful upload as a failure,
      // so the loop keeps the last state it knows and tries again.
      continue;
    }
    onUpdate?.(latest);
  }

  return latest;
}

/** Resolves early when `signal` aborts, so a five-minute poll can be dropped. */
function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const done = () => {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    };
    const timer = setTimeout(done, ms);
    signal?.addEventListener("abort", done, { once: true });
  });
}
