"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { getFeed } from "@/lib/api/videos";
import { isLastPage } from "@/lib/api/types";
import type { FeedVideo } from "@/types/tiktok";

export interface VideoFeedState {
  videos: FeedVideo[];
  isLoading: boolean;
  /** Set when the first page failed — the caller decides what to show. */
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
}

const PAGE_SIZE = 20;

/**
 * `GET /videos/feed`, paged.
 *
 * Two rules from the contract shape this, and both are easy to get wrong:
 *
 *  - **De-duplicate by id.** Paging is offset-based over a list that grows at
 *    the head, so a video seen on page 0 can be handed back on page 1 once
 *    newer uploads push it down. Appending blindly duplicates cards.
 *  - **Stop on `totalPages`, never on a short page.** A page with fewer than
 *    `size` items is normal and says nothing about whether more exist.
 */
export function useVideoFeed(): VideoFeedState {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(true);

  const nextPage = useRef(0);
  const inFlight = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());

  const load = useCallback(async (signal?: AbortSignal) => {
    if (inFlight.current) return;
    inFlight.current = true;

    try {
      const page = await getFeed(nextPage.current, PAGE_SIZE, signal);
      const authors = await resolveAuthors(
        page.content.map((video) => video.userId),
      );

      const fresh = page.content
        .filter((video) => !seenIds.current.has(video.id))
        .map((video) => {
          seenIds.current.add(video.id);
          return videoToFeedVideo(
            video,
            authors.get(video.userId) ?? {
              username: video.userId,
              nickname: `user${video.userId}`,
              avatarUrl: "/images/avatars/avatar-1.jpeg",
            },
          );
        });

      setVideos((current) => [...current, ...fresh]);
      setHasMore(!isLastPage(page.page));
      nextPage.current = page.page.number + 1;
      setError(null);
    } catch (cause) {
      if (!signal?.aborted) setError(cause);
    } finally {
      inFlight.current = false;
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const loadMore = useCallback(() => {
    if (!hasMore || inFlight.current) return;
    load();
  }, [hasMore, load]);

  return { videos, isLoading, error, hasMore, loadMore };
}
