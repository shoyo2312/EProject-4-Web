"use client";

import { useCallback, useEffect, useState } from "react";

import { isBackendHandle } from "@/lib/api/adapters";
import { getSaveStatus, saveVideo, unsaveVideo } from "@/lib/api/interactions";

/**
 * Bookmark state for one video. Seeds it for a returning viewer — one video,
 * so this asks about that video rather than reading the whole favourites list
 * as the feed's `useSavedVideos` does — and toggles optimistically with a
 * silent rollback on failure.
 */
export function useVideoSave(videoId: string) {
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!isBackendHandle(videoId)) return;
    let cancelled = false;
    getSaveStatus(videoId)
      .then((status) => {
        if (!cancelled) setSaved(status.saved);
      })
      .catch(() => {
        // Signed out, or the call failed — the bookmark starts unfilled.
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const toggleSave = useCallback(() => {
    setSaved((current) => {
      const next = !current;
      if (isBackendHandle(videoId)) {
        (next ? saveVideo(videoId) : unsaveVideo(videoId)).catch(() => {
          setSaved(current);
        });
      }
      return next;
    });
  }, [videoId]);

  return { saved, toggleSave };
}
