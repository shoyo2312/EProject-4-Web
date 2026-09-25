"use client";

import { useEffect, useState } from "react";

import type { CommentRestriction } from "@/lib/api/types";
import { getCommentPermission } from "@/lib/api/interactions";

/**
 * Why `viewerId` may not comment on this video, or null when they may — and
 * null while the answer is on its way, or when it never arrives, so the box
 * stays up and the post itself still gets the final word.
 *
 * Pass a null `viewerId` to skip the read: signed out there is nobody to ask
 * about, and the caller already knows when it would be pointless.
 */
export function useCommentRestriction(
  videoId: string,
  viewerId: string | null,
): CommentRestriction | null {
  const key = viewerId ? `${viewerId}:${videoId}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    restriction: CommentRestriction | null;
  } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    getCommentPermission(videoId).then(
      ({ restriction }) => {
        if (!cancelled) setLoaded({ key, restriction });
      },
      () => {
        // Unknown is treated as allowed — see the doc above.
      },
    );

    return () => {
      cancelled = true;
    };
  }, [key, videoId]);

  // Keyed by viewer and video, so an answer about one never shows on another.
  return loaded?.key === key ? loaded.restriction : null;
}
