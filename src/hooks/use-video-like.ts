"use client";

import { useCallback } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { useLikeDebounce } from "@/hooks/use-like-debounce";
import { likeVideo, unlikeVideo } from "@/lib/api/interactions";
import type { LikeStatusResponse } from "@/lib/api/types";
import { displayLikeCount } from "@/lib/likes";

/**
 * The heart for one video, shared by the feed's cards and `/video/[id]`.
 *
 * Taps flip it at once and go out as one request per burst — see
 * `useLikeDebounce`. The reply goes to `onConfirmed`, because the server's
 * side lives with whoever seeded it (`useLikeStatuses`). Liking needs an
 * account: signed out, the live site swallows the tap and opens the login
 * modal instead.
 */
export function useVideoLike({
  videoId,
  serverLiked,
  serverCount,
  onConfirmed,
}: {
  videoId: string;
  /** The viewer's like as the server last confirmed it. */
  serverLiked: boolean;
  /** The server's latest count — it already includes a confirmed like. */
  serverCount: number;
  onConfirmed: (status: LikeStatusResponse) => void;
}) {
  const { requireSignIn } = useSession();

  const send = useCallback(
    async (liked: boolean) => {
      const status = liked ? await likeVideo(videoId) : await unlikeVideo(videoId);
      // The reply carries the true state and count — the debounced tap only
      // guessed, and is stale the moment anyone else likes the same video.
      onConfirmed(status);
    },
    [videoId, onConfirmed],
  );

  const { liked, toggle } = useLikeDebounce(serverLiked, send);

  const toggleLike = useCallback(() => {
    if (requireSignIn()) toggle();
  }, [requireSignIn, toggle]);

  /** The double-tap path: only ever fills the heart, never clears it. */
  const likeOnly = useCallback(() => {
    if (requireSignIn() && !liked) toggle();
  }, [requireSignIn, liked, toggle]);

  return {
    liked,
    likeCount: displayLikeCount(serverCount, liked, serverLiked),
    toggleLike,
    likeOnly,
  };
}
