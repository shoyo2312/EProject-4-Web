"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { getPersonalizedFeed } from "@/lib/api/recommendations";
import { getFeed, getVideosByIds } from "@/lib/api/videos";
import type { VideoResponse } from "@/lib/api/types";
import type { FeedVideo } from "@/types/tiktok";

export interface VideoFeedState {
  videos: FeedVideo[];
  isLoading: boolean;
  /** Set when the first page failed — the caller decides what to show. */
  error: unknown;
  hasMore: boolean;
  loadMore: () => void;
  /** True while videos are coming from the ranking rather than by recency. */
  isPersonalized: boolean;
}

const PAGE_SIZE = 20;

/**
 * How many chronological pages one `loadMore` may pull while every video on
 * them is one the viewer has already been shown. Without a bound this is an
 * unbounded scan of the whole library; without *any* retry the feed can stall,
 * because a page that adds nothing does not grow the scroll container and so
 * never triggers the next `loadMore`.
 */
const MAX_EMPTY_PAGES = 3;

/**
 * The "For You" feed, from two sources with a one-way fall back.
 *
 *  1. **Ranked** — `GET /recommendations/feed` while signed in. Returns ids and
 *     scores; the videos are hydrated in one batch call. There is no cursor:
 *     the server suppresses what it already served this viewer, so asking again
 *     *is* the next page.
 *  2. **Chronological** — `GET /videos/feed`, cursor-paged, newest first. What
 *     a signed-out viewer gets, and where a signed-in one lands once the ranked
 *     candidate pool runs dry (which happens routinely on a small library).
 *
 * The fall back is one-way for the session. Going back to the ranked source
 * after it returned nothing would just re-ask a server that already told us it
 * has nothing left within its 30-minute suppression window.
 */
export function useVideoFeed(): VideoFeedState {
  const { isSignedIn, isLoading: sessionLoading } = useSession();

  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [hasMore, setHasMore] = useState(true);
  const [isPersonalized, setPersonalized] = useState(false);

  const inFlight = useRef(false);
  const seenIds = useRef<Set<string>>(new Set());

  /** Position in the chronological feed; null means "start at the newest". */
  const cursor = useRef<string | undefined>(undefined);
  const chronologicalExhausted = useRef(false);
  /** Set once the ranking has nothing left to offer. One-way, see above. */
  const rankingExhausted = useRef(false);

  /** Backend videos → cards, resolving each author's profile alongside. */
  const toCards = useCallback(async (rows: VideoResponse[]) => {
    const unseen = rows.filter((video) => !seenIds.current.has(video.id));
    if (unseen.length === 0) return [];

    const authors = await resolveAuthors(unseen.map((video) => video.userId));
    return unseen.map((video) => {
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
  }, []);

  /**
   * Returns the cards, and whether the ranking is spent. Those are two different
   * answers: no ids at all means spent, whereas ids that all failed to hydrate
   * only means those particular videos are gone — deleted since they were
   * ranked, most likely — and the ranking may still have more behind them.
   */
  const loadRanked = useCallback(
    async (signal?: AbortSignal) => {
      const ranked = await getPersonalizedFeed(PAGE_SIZE, signal);
      if (ranked.length === 0) return { cards: [], spent: true };

      // Order is the ranking; the batch endpoint answers in the order asked, so
      // it survives the round trip and nothing here needs to re-sort.
      const rows = await getVideosByIds(
        ranked.map((item) => item.videoId),
        signal,
      );
      return { cards: await toCards(rows), spent: false };
    },
    [toCards],
  );

  const loadChronological = useCallback(
    async (signal?: AbortSignal) => {
      const cards: FeedVideo[] = [];

      for (let attempt = 0; attempt < MAX_EMPTY_PAGES; attempt += 1) {
        if (chronologicalExhausted.current) break;

        const page = await getFeed(cursor.current, PAGE_SIZE, signal);
        cursor.current = page.nextCursor ?? undefined;
        // Null cursor is the end of the feed; that is the whole protocol. A
        // short page says nothing — the last full page still hands one back.
        if (page.nextCursor === null) chronologicalExhausted.current = true;

        cards.push(...(await toCards(page.items)));
        // Everything on that page was already on screen — from the ranked pass,
        // most likely, which draws from the same library. Keep going, or the
        // feed stalls with a scroll container that never grew.
        if (cards.length > 0) break;
      }

      return cards;
    },
    [toCards],
  );

  const load = useCallback(
    async (signal?: AbortSignal) => {
      if (inFlight.current) return;
      inFlight.current = true;

      try {
        let cards: FeedVideo[] = [];

        if (isSignedIn && !rankingExhausted.current) {
          try {
            const ranked = await loadRanked(signal);
            cards = ranked.cards;
            if (ranked.spent) rankingExhausted.current = true;
            setPersonalized(!ranked.spent && cards.length > 0);
          } catch (cause) {
            if (signal?.aborted) throw cause;
            // recommendation-service being down must not take the feed with it:
            // there is a perfectly good chronological one, and the viewer would
            // rather have videos in the wrong order than none at all.
            rankingExhausted.current = true;
            setPersonalized(false);
          }
        }

        // Also runs when the ranked pass returned ids that all failed to
        // hydrate, so a batch of freshly deleted videos does not show up as an
        // empty screen.
        if (cards.length === 0) {
          cards = await loadChronological(signal);
        }

        setVideos((current) => [...current, ...cards]);
        setHasMore(!rankingExhausted.current || !chronologicalExhausted.current);
        setError(null);
      } catch (cause) {
        if (!signal?.aborted) setError(cause);
      } finally {
        // An aborted attempt owns nothing: the cleanup that aborted it has
        // already released the latch, and a `setLoading(false)` from a dead
        // request would blank the feed while its replacement is still running.
        if (!signal?.aborted) {
          inFlight.current = false;
          setLoading(false);
        }
      }
    },
    [isSignedIn, loadRanked, loadChronological],
  );

  /**
   * Held until `/me` settles. Loading before that would ask the chronological
   * feed on behalf of a viewer who *is* signed in — the session is established
   * in the browser, so the first render of a logged-in visitor still reports
   * signed out — and the ranked feed would never get a turn.
   */
  useEffect(() => {
    if (sessionLoading) return;

    const controller = new AbortController();
    load(controller.signal);
    return () => {
      controller.abort();
      // Synchronously, because the abort only rejects the fetch a microtask
      // later — and StrictMode's remount calls `load` before that lands. Left
      // to the `finally`, the second call found the latch still held, returned
      // at once, and the For You page stayed empty with nothing to retry it.
      inFlight.current = false;
    };
  }, [load, sessionLoading]);

  const loadMore = useCallback(() => {
    if (!hasMore || inFlight.current) return;
    load();
  }, [hasMore, load]);

  return { videos, isLoading, error, hasMore, loadMore, isPersonalized };
}
