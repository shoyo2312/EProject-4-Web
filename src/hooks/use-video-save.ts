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
export function useVideoSave(videoId: string, signedIn: boolean) {
  const [saved, setSaved] = useState(false);

  // Signed out there is nothing to ask: the status endpoint needs a token.
  useEffect(() => {
    if (!signedIn || !isBackendHandle(videoId)) return;
    let cancelled = false;
    getSaveStatus(videoId)
      .then((status) => {
        if (!cancelled) setSaved(status.saved);
      })
      .catch(() => {
        // The call failed — the bookmark starts unfilled.
      });
    return () => {
      cancelled = true;
    };
  }, [videoId, signedIn]);

  // The request goes out here, never from inside a `setSaved` updater: React
  // may run an updater twice, which sent the save twice and let the second
  // one's failure roll back a save that had worked.
  const toggleSave = useCallback(() => {
    const next = !saved;
    setSaved(next);
    if (!isBackendHandle(videoId)) return;
    (next ? saveVideo(videoId) : unsaveVideo(videoId)).catch(() => {
      setSaved(!next);
    });
  }, [videoId, saved]);

  return { saved, toggleSave };
}
