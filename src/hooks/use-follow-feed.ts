"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toFeedCards } from "@/lib/api/feed-cards";
import { getFollowingIds, getFriendIds } from "@/lib/api/users";
import { getFollowingFeed } from "@/lib/api/videos";
import type { FeedVideo } from "@/types/tiktok";

/**
 * Which slice of the follow graph the feed is drawn from. `friends` is the
 * mutuals — accounts the viewer follows that follow back.
 */
export type FollowFeedSource = "following" | "friends";

export interface FollowFeedState {
  videos: FeedVideo[];
  isLoading: boolean;
  /** Set when the first page failed — the caller decides what to show. */
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /**
   * Nobody qualifies: no follows at all, or — on `friends` — nobody who follows
   * back. Distinct from an empty `videos` array, which also covers "they simply
   * have not posted"; the page shows the creator grid for both, but only this
   * one is a state the viewer can fix.
   */
  isEmptyGraph: boolean;
}

const PAGE_SIZE = 20;

/**
 * The Following and Friends feeds: `GET /videos/feed/following`, cursor-paged
 * and newest first, exactly like "For You" minus the ranking.
 *
 * One hook for both because only the author list differs — Friends is Following
 * narrowed to the accounts that follow back, and there is no separate endpoint
 * or different page shape behind it.
 *
 * Two calls per feed, not one. video-service holds no follow graph, so the ids
 * come from user-service first and are then passed down with every page. They
 * are read **once per mount** and reused: following somebody mid-scroll does not
 * splice their videos into the page you are on, which is what the live site does
 * too.
 *
 * Signed out there is nothing to ask — the follow listings need a token — so the
 * hook settles immediately with an empty feed and the route falls to its
 * suggestion grid.
 */
export function useFollowFeed(source: FollowFeedSource = "following"): FollowFeedState {
  const { user, isLoading: sessionLoading } = useSession();
  const viewerId = user?.userId;

  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isEmptyGraph, setEmptyGraph] = useState(false);

  const inFlight = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());
  /** Resolved on the first page and reused for the rest — see above. */
  const followedIds = useRef<string[] | null>(null);
  /** Which source those ids came from, so a switched `source` re-resolves. */
  const resolvedFor = useRef<FollowFeedSource | null>(null);
  /** Position in the feed; undefined means "start at the newest". */
  const cursor = useRef<string | undefined>(undefined);

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (!viewerId || inFlight.current) return;
      inFlight.current = true;

      try {
        if (followedIds.current === null || resolvedFor.current !== source) {
          followedIds.current =
            source === "friends"
              ? await getFriendIds(viewerId)
              : await getFollowingIds(viewerId);
          resolvedFor.current = source;
          setEmptyGraph(followedIds.current.length === 0);
        }

        const page = await getFollowingFeed(
          followedIds.current,
          cursor.current,
          PAGE_SIZE,
          signal,
        );
        cursor.current = page.nextCursor ?? undefined;
        // Null cursor is the end of the feed, and the only stop condition there
        // is — a short page still has successors.
        if (page.nextCursor === null) setHasMore(false);

        const cards = await toFeedCards(page.items, seenIds.current);
        setVideos((current) => [...current, ...cards]);
        setError(null);
      } catch (cause) {
        if (!signal?.aborted) setError(cause);
      } finally {
        // An aborted attempt owns nothing: its replacement is already running,
        // and a `setLoading(false)` from here would blank the feed under it.
        if (!signal?.aborted) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [viewerId, source],
  );

  useEffect(() => {
    if (sessionLoading) return;

    // No token, no follow listing. Settle rather than sit on the skeleton.
    if (!viewerId) {
      setLoading(false);
      setHasMore(false);
      return;
    }

    const controller = new AbortController();
    load(controller.signal);
    return () => {
      controller.abort();
      // Synchronously — the abort only rejects the fetch a microtask later, and
      // StrictMode's remount calls `load` before that lands. Left to the
      // `finally`, the second call finds the latch still held and returns at
      // once, leaving the page empty with nothing to retry it.
      inFlight.current = false;
    };
  }, [load, sessionLoading, viewerId]);

  const loadMore = useCallback(() => {
    if (!hasMore || inFlight.current) return;
    load();
  }, [hasMore, load]);

  return { videos, isLoading, error, hasMore, loadMore, isEmptyGraph };
}
