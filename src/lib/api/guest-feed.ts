import { parseJsonPreservingIds } from "@/lib/api/json";
import type { CursorPage, VideoResponse } from "@/lib/api/types";

/**
 * The first page of the signed-out "For You" feed, read by the page's server render so a visitor
 * without a session does not wait for the bundle, then `/me`, then this same request before any
 * video can show.
 *
 * Server-side only: it calls the gateway on the internal network (`API_GATEWAY_URL`), not through
 * the site's own `/api` rewrite. Only the guest feed can be read here — the session lives in the
 * browser's storage, so the server cannot tell a signed-in visitor apart, and a signed-in one is
 * given the ranked feed instead (see `useVideoFeed`).
 */
export interface GuestFeedPage {
  page: CursorPage<VideoResponse>;
  /** When the server read it, so the browser can refuse a copy that sat in the page cache too long. */
  fetchedAt: number;
}

const GATEWAY_URL = process.env.API_GATEWAY_URL ?? "http://localhost:8080";
/** Same size the browser asks for, so paging on from this page lines up. */
export const GUEST_FEED_PAGE_SIZE = 20;
/** How long the server reuses one read; the page itself is cached for as long. */
export const GUEST_FEED_REVALIDATE_SECONDS = 30;

/** Null whenever the gateway cannot answer in time: the browser then reads the feed itself. */
export async function loadGuestFeedPage(): Promise<GuestFeedPage | null> {
  try {
    const response = await fetch(`${GATEWAY_URL}/api/v1/videos/feed?size=${GUEST_FEED_PAGE_SIZE}`, {
      next: { revalidate: GUEST_FEED_REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(2_000),
    });
    if (!response.ok) return null;
    const body = parseJsonPreservingIds<{ success?: boolean; data?: CursorPage<VideoResponse> }>(
      await response.text(),
    );
    return body.success && body.data ? { page: body.data, fetchedAt: Date.now() } : null;
  } catch {
    return null;
  }
}
