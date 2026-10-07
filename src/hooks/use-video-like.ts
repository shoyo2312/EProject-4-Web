"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { isBackendHandle } from "@/lib/api/adapters";
import { getLikeStatus, likeVideo, unlikeVideo } from "@/lib/api/interactions";

/**
 * Heart state for one video on `/video/[id]`.
 *
 * Seeds the heart for a returning viewer once; after that the tally is kept
 * live by the page's counts frames, handed in through `syncLikeCount`. Signed
 * out there is nothing to ask — the status endpoint needs a token, and so does
 * the socket — so the count stays the one the page was rendered with. Mock
 * videos have no backend to ask and toggle locally.
 *
 * `initialCount` already counts the viewer's own like, so a filled heart must
 * not add another — the server figure overrides the rendered one.
 */
export function useVideoLike(videoId: string, initialCount: number, signedIn: boolean) {
  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialCount);

  /** Set while a like/unlike round trip is open, so a count landing mid-flight
   *  does not overwrite the optimistic heart with a server count that has not
   *  caught up yet — the mutation's own `.then` is the authority in that window. */
  const inFlight = useRef(false);

  useEffect(() => {
    if (!signedIn || !isBackendHandle(videoId)) return;
    let cancelled = false;

    getLikeStatus(videoId)
      .then((status) => {
        if (cancelled || inFlight.current) return;
        setLiked(status.liked);
        setLikeCount(status.likeCount);
      })
      .catch(() => {
        // The call failed — leave whatever is on screen.
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, signedIn]);

  /** A counts frame's tally — newer than anything here unless a toggle is still in flight. */
  const syncLikeCount = useCallback((count: number) => {
    if (!inFlight.current) setLikeCount(count);
  }, []);

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

  return { liked, likeCount, toggleLike, likeOnly, syncLikeCount };
}
