/**
 * Remembers the in-app route that opened a full-page overlay (the video detail
 * page), so the overlay's Close button knows whether `router.back()` is safe.
 *
 * `window.history.length > 1` cannot answer that: it also counts entries from
 * other sites, so a visitor arriving at /video/x1 from a search result would be
 * sent back out of the app. Module state instead resets on every hard document
 * load, which is exactly the signal we want — it is only set when a soft
 * navigation inside the app opened the overlay.
 */

let origin: string | null = null;

/** Call from the link/handler that navigates into the overlay. */
export function markOverlayOrigin(path: string) {
  origin = path;
}

/** The route the overlay was opened from, or `null` on a direct visit. */
export function getOverlayOrigin() {
  return origin;
}
