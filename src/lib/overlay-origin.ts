/**
 * Remembers the in-app route that opened a full-page overlay (the video detail
 * page), so the overlay's Close button knows whether `router.back()` is safe.
 *
 * `window.history.length > 1` cannot answer that: it also counts entries from
 * other sites, so a visitor arriving at /video/x1 from a search result would be
 * sent back out of the app. Module state instead resets on every hard document
 * load, which is exactly the signal we want — it is only set when a soft
 * navigation inside the app opened the overlay.
 *
 * It also carries the ordered id list of the grid that opened the overlay, so
 * the up/down controls step through *that* collection — a Favorites or Liked
 * grid, not the author's own uploads. Cleared on a plain `markOverlayOrigin`
 * (Explore, the feed), so a stale list never leaks into an unrelated overlay.
 */

let origin: string | null = null;
let collection: string[] | null = null;

/**
 * Call from the link/handler that navigates into the overlay. Pass `ids` when
 * the overlay should step through a specific ordered list; omit it to clear any
 * previous list.
 */
export function markOverlayOrigin(path: string, ids?: string[]) {
  origin = path;
  collection = ids ?? null;
}

/** The route the overlay was opened from, or `null` on a direct visit. */
export function getOverlayOrigin() {
  return origin;
}

/** The ordered id list the overlay was opened from, or `null`. */
export function getOverlayCollection() {
  return collection;
}
