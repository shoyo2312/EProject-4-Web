"use client";

import { apiFetch } from "@/lib/api/client";
import type { PageResponse, VideoSearchResponse } from "@/lib/api/types";

/**
 * search-service, through the gateway. Public: unlike `searchUsers`, these
 * reads need no token — the index holds PUBLISHED videos only, so there is
 * nothing in it a signed-out viewer may not see.
 */

/**
 * What the server should be asked for a term the viewer typed.
 *
 * A leading `#` is the whole difference between the two parameters the endpoint
 * takes: `hashtag` filters on the exact tag (a keyword field), while `q` is a
 * free-text match over title, description **and** tags. So "#dance" means only
 * videos tagged dance, and "dance" also finds the ones that merely say it in
 * the caption — which is what typing each of those means to a viewer.
 */
export function searchParamsFor(term: string): { q?: string; hashtag?: string } {
  const trimmed = term.trim();
  return trimmed.startsWith("#") ? { hashtag: trimmed } : { q: trimmed };
}

/**
 * What search-service actually sends: a raw Spring `Page`, with the metadata
 * flat beside `content` rather than under `page` as user- and video-service
 * shape theirs. Normalised below so the UI sees one `PageResponse`.
 */
interface FlatSpringPage<T> {
  content: T[];
  number: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

function toPageResponse<T>(raw: FlatSpringPage<T>): PageResponse<T> {
  return {
    content: raw.content,
    page: {
      number: raw.number,
      size: raw.size,
      totalElements: raw.totalElements,
      totalPages: raw.totalPages,
    },
  };
}

/**
 * `GET /api/v1/search/videos?q=|hashtag=` — offset paged, newest-scoring first.
 *
 * Offsets rather than a cursor, because that is what the endpoint offers; the
 * feed's argument against them does not bite here, since a result set does not
 * grow at the head while somebody reads it.
 */
export async function searchVideos(
  term: string,
  page = 0,
  size = 24,
  signal?: AbortSignal,
): Promise<PageResponse<VideoSearchResponse>> {
  const raw = await apiFetch<FlatSpringPage<VideoSearchResponse>>("/search/videos", {
    auth: "optional",
    query: { ...searchParamsFor(term), page, size },
    signal,
  });
  return toPageResponse(raw);
}
