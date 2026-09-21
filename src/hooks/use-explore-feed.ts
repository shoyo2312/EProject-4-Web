"use client";

import { useEffect, useState } from "react";

import { unknownAuthor, videoToExploreItem } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { searchVideos } from "@/lib/api/search";
import { getFeed, getVideosByIds } from "@/lib/api/videos";
import type { ExploreItem } from "@/types/tiktok";

const PAGE_SIZE = 24;

export interface ExploreFeedState {
  items: ExploreItem[];
  isLoading: boolean;
  error: unknown;
}

/**
 * The Explore grid's tiles for one category tab.
 *
 * video-service has no category taxonomy, so "All" is the plain public feed
 * and every other tab is search-service's free-text match on the tab's own
 * label — the closest real thing to "browse this category" the backend
 * offers. Search hands back a lighter DTO with no `hlsUrl`, so its ids are
 * re-hydrated through `getVideosByIds` (one round trip) to get a URL the tile
 * can preview on hover.
 */
export function useExploreFeed(category: string): ExploreFeedState {
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [error, setError] = useState<unknown>(null);
  // The category `items`/`error` were last resolved for. Mismatched against
  // `category` while a fetch is in flight, which is what drives `isLoading`
  // without a synchronous reset at the top of the effect.
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const videos =
        category === "All"
          ? (await getFeed(undefined, PAGE_SIZE, controller.signal)).items
          : await hydrateSearchResults(category, controller.signal);

      const authors = await resolveAuthors(videos.map((video) => video.userId));
      return videos.map((video) =>
        videoToExploreItem(
          video,
          authors.get(video.userId) ?? unknownAuthor(video.userId),
          category,
        ),
      );
    };

    load()
      .then((cards) => {
        if (controller.signal.aborted) return;
        setItems(cards);
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(category);
      });

    return () => controller.abort();
  }, [category]);

  return { items, isLoading: loadedFor !== category, error };
}

async function hydrateSearchResults(term: string, signal: AbortSignal) {
  const page = await searchVideos(term, 0, PAGE_SIZE, signal);
  return getVideosByIds(
    page.content.map((item) => item.id),
    signal,
  );
}
