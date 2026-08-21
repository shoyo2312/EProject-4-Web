"use client";

import { apiFetch } from "@/lib/api/client";
import type { WatchResponse } from "@/lib/api/types";

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
