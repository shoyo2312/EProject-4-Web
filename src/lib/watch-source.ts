import type { WatchSource } from "@/lib/api/types";

type LinkSource = "search" | "profile" | "explore" | "message";

const BY_PARAM: Record<LinkSource, WatchSource> = {
  search: "SEARCH",
  profile: "PROFILE",
  explore: "EXPLORE",
  message: "MESSAGE",
};

/**
 * Where `/video/{id}` was opened from, as its `src` query parameter says. A
 * link without one — typed, shared, bookmarked — is a direct visit, and so is
 * anything the parameter does not name.
 */
export function watchSourceFromParams(src: string | null): WatchSource {
  return src !== null && Object.hasOwn(BY_PARAM, src) ? BY_PARAM[src as LinkSource] : "DIRECT";
}

/** A link to `/video/{id}` that says where it was clicked, and for search, what was searched. */
export function videoHref(id: string, src: LinkSource, q?: string): string {
  const query = src === "search" && q ? `&q=${encodeURIComponent(q)}` : "";
  return `/video/${encodeURIComponent(id)}?src=${src}${query}`;
}
