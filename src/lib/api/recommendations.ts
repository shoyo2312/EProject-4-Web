"use client";

import { apiFetch } from "@/lib/api/client";
import type { FeedItemResponse } from "@/lib/api/types";

/**
 * recommendation-service. The personalized feed needs a token — the ranking is
 * built from *this* viewer's watch history — so there is nothing to ask for
 * while signed out and the caller uses the chronological feed instead.
 */

/**
 * `GET /api/v1/recommendations/feed`. Ids and scores; hydrate with
 * `getVideosByIds`.
 *
 * Calling it again returns the *next* items, not the same ones: the server
 * suppresses what it already served this viewer (30 minutes) and what they have
 * already watched. So there is no cursor to carry, and equally no way to ask for
 * page 0 again — a reload starts wherever the suppression list leaves off.
 *
 * An empty array means the candidate pool is exhausted, which happens routinely
 * on a small library. It is a signal to fall back, not a failure.
 */
export function getPersonalizedFeed(
  limit = 20,
  signal?: AbortSignal,
): Promise<FeedItemResponse[]> {
  return apiFetch<FeedItemResponse[]>("/recommendations/feed", {
    auth: "required",
    query: { limit },
    signal,
  });
}
