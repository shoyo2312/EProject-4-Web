"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isBackendHandle } from "@/lib/api/adapters";
import { getLikeStatus, likeVideo, unlikeVideo } from "@/lib/api/interactions";

/** How often the single-video page re-asks the server for the like tally. */
const LIKE_POLL_MS = 10_000;

/**
 * Heart state for one video on `/video/[id]`.
 *
 * Seeds the heart for a returning viewer, then keeps the count live: the tally
 * moves whenever anyone else likes the video, and `getLikeStatus` returns the
 * absolute figure, so re-asking it on an interval is the whole of the refresh.
 * Mock videos have no backend to ask and toggle locally.
 *
 * Deliberately dumb polling. A single open video page does not warrant a live
 * channel; if the comment list needs the same treatment that is where SSE
 * earns its keep, not here.
 *
 * `initialCount` already counts the viewer's own like, so a filled heart must
 * not add another — the server figure overrides the rendered one.
 */
export function useVideoLike(videoId: string, initialCount: number) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialCount);

  /** Set while a like/unlike round trip is open, so a poll landing mid-flight
   *  does not overwrite the optimistic heart with a server count that has not
   *  caught up yet — the mutation's own `.then` is the authority in that window. */
  const inFlight = useRef(false);

  useEffect(() => {
    if (!isBackendHandle(videoId)) return;
    let cancelled = false;

    const sync = () =>
      getLikeStatus(videoId)
        .then((status) => {
          if (cancelled || inFlight.current) return;
          setLiked(status.liked);
          setLikeCount(status.likeCount);
        })
        .catch(() => {
          // No session, or the call failed — leave whatever is on screen.
        });

    sync();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, LIKE_POLL_MS);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [videoId]);

  const setLike = useCallback(
    (next: boolean) => {
      setLiked(next);
      setLikeCount((count) => count + (next ? 1 : -1));
      if (!isBackendHandle(videoId)) return;

      inFlight.current = true;
      (next ? likeVideo(videoId) : unlikeVideo(videoId))
        // The optimistic bump above is only a guess at the shared count.
        .then((status) => setLikeCount(status.likeCount))
        .catch(() => {
          // Silent rollback, matching the feed's like button.
          setLiked(!next);
          setLikeCount((count) => count + (next ? -1 : 1));
        })
        .finally(() => {
          inFlight.current = false;
        });
    },
    [videoId],
  );

  const toggleLike = useCallback(() => setLike(!liked), [liked, setLike]);

  /** The double-tap path: only ever fills the heart, never clears it. */
  const likeOnly = useCallback(() => {
    if (!liked) setLike(true);
  }, [liked, setLike]);

  return { liked, likeCount, toggleLike, likeOnly };
}
