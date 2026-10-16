"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { unknownAuthor, videoToExploreItem } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { searchVideos } from "@/lib/api/search";
import { isLastPage } from "@/lib/api/types";
import { getFeed, getVideosByIds } from "@/lib/api/videos";
import { appendUnique } from "@/lib/paging";
import type { ExploreItem } from "@/types/tiktok";

const PAGE_SIZE = 24;

export interface ExploreFeedState {
  items: ExploreItem[];
  isLoading: boolean;
  error: unknown;
  /** Fetches the next page; absent once there is none. */
  loadMore?: () => void;
}

/** Where the next page starts: the feed's cursor, or search's page number. */
type Position = { cursor?: string; page: number };

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
  const [hasMore, setHasMore] = useState(false);
  const next = useRef<Position | null>(null);
  const loadingMore = useRef(false);
  /** Bumped per category, so a page still in flight from the last tab is dropped. */
  const epoch = useRef(0);

  useEffect(() => {
    const controller = new AbortController();
    epoch.current += 1;
    next.current = null;

    fetchPage(category, { page: 0 }, controller.signal)
      .then(({ cards, after }) => {
        if (controller.signal.aborted) return;
        setItems(cards);
        setError(null);
        next.current = after;
        setHasMore(after !== null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setItems([]);
        setError(cause);
        setHasMore(false);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoadedFor(category);
      });

    return () => controller.abort();
  }, [category]);

  const loadMore = useCallback(async () => {
    const position = next.current;
    if (!position || loadingMore.current) return;
    loadingMore.current = true;
    const started = epoch.current;
    try {
      const { cards, after } = await fetchPage(category, position);
      if (started !== epoch.current) return;
      setItems((current) => appendUnique(current, cards));
      next.current = after;
      setHasMore(after !== null);
    } catch {
      // Left as it was: the grid's sentinel retries on the next scroll.
    } finally {
      loadingMore.current = false;
    }
  }, [category]);

  return {
    items,
    isLoading: loadedFor !== category,
    error,
    loadMore: hasMore ? loadMore : undefined,
  };
}

async function fetchPage(
  category: string,
  position: Position,
  signal?: AbortSignal,
): Promise<{ cards: ExploreItem[]; after: Position | null }> {
  let videos;
  let after: Position | null;
  if (category === "All") {
    const page = await getFeed(position.cursor, PAGE_SIZE, signal);
    videos = page.items;
    after = page.nextCursor ? { cursor: page.nextCursor, page: 0 } : null;
  } else {
    const page = await searchVideos(category, position.page, PAGE_SIZE, signal);
    videos = await getVideosByIds(
      page.content.map((item) => item.id),
      signal,
    );
    after = isLastPage(page.page) ? null : { page: position.page + 1 };
  }

  const authors = await resolveAuthors(videos.map((video) => video.userId));
  const cards = videos.map((video) =>
    videoToExploreItem(
      video,
      authors.get(video.userId) ?? unknownAuthor(video.userId),
      category,
    ),
  );
  return { cards, after };
}
