"use client";

import { useCallback, useEffect, useState } from "react";

import type { CommentRestriction } from "@/lib/api/types";
import { getCommentPermission } from "@/lib/api/interactions";

export interface CommentPermission {
  restriction: CommentRestriction | null;
  /** Epoch ms when `COMMENTING_RESTRICTED` lifts; null with any other answer. */
  restrictedUntil: number | null;
  /** Locks the box until `until` (epoch ms) — for a post refused as restricted. */
  restrict: (until: number) => void;
}

/**
 * Why `viewerId` may not comment on this video, or null when they may — and
 * null while the answer is on its way, or when it never arrives, so the box
 * stays up and the post itself still gets the final word.
 *
 * Pass a null `viewerId` to skip the read: signed out there is nobody to ask
 * about, and the caller already knows when it would be pointless.
 *
 * A restriction on the viewer's own account lifts by itself, so the answer
 * goes back to null at `restrictedUntil` without asking again.
 */
export function useCommentRestriction(
  videoId: string,
  viewerId: string | null,
): CommentPermission {
  const key = viewerId ? `${viewerId}:${videoId}` : null;
  const [loaded, setLoaded] = useState<{
    key: string;
    restriction: CommentRestriction | null;
    restrictedUntil: number | null;
  } | null>(null);

  useEffect(() => {
    if (!key) return;
    let cancelled = false;

    getCommentPermission(videoId).then(
      ({ restriction, restrictedUntil }) => {
        if (cancelled) return;
        setLoaded({
          key,
          restriction,
          restrictedUntil: (restrictedUntil && Date.parse(restrictedUntil)) || null,
        });
      },
      () => {
        // Unknown is treated as allowed — see the doc above.
      },
    );

    return () => {
      cancelled = true;
    };
  }, [key, videoId]);

  const until = loaded?.restrictedUntil ?? null;
  useEffect(() => {
    if (until === null) return;
    const id = window.setTimeout(
      () =>
        setLoaded((current) =>
          current && { ...current, restriction: null, restrictedUntil: null },
        ),
      until - Date.now(),
    );
    return () => window.clearTimeout(id);
  }, [until]);

  const restrict = useCallback(
    (at: number) => {
      if (key) setLoaded({ key, restriction: "COMMENTING_RESTRICTED", restrictedUntil: at });
    },
    [key],
  );

  // Keyed by viewer and video, so an answer about one never shows on another.
  const current = loaded?.key === key ? loaded : null;
  return {
    restriction: current?.restriction ?? null,
    restrictedUntil: current?.restrictedUntil ?? null,
    restrict,
  };
}
