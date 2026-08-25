"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import { listSavedVideos, saveVideo, unsaveVideo } from "@/lib/api/interactions";

interface SavedVideos {
  isSaved: (videoId: string) => boolean;
  /** Optimistic, with a silent rollback on failure — same contract as the heart. */
  toggleSave: (videoId: string) => void;
}

/**
 * How many pages of the viewer's favourites to read at start-up.
 *
 * ponytail: a 500-save ceiling, above which older favourites render unfilled
 * until they are toggled. Swap for a per-video `getSaveStatus` batch endpoint if
 * that ever matters — one does not exist yet, and asking per video is what this
 * avoids: the feed shows 20 cards and the gateway allows 20 requests a second
 * per IP, which every viewer behind the Next proxy shares.
 */
const MAX_PAGES = 10;
const PAGE_SIZE = 50;

/**
 * The viewer's favourites, as one set fetched once, shared by every bookmark
 * button on the page.
 */
export function useSavedVideos(): SavedVideos {
  const { user, requireSignIn } = useSession();
  const [savedIds, setSavedIds] = useState<ReadonlySet<string>>(new Set());

  // Signed out there is nothing to ask: every save endpoint needs a token, so
  // the bookmarks start empty and the tap opens the login modal.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      const ids: string[] = [];
      let cursor: string | undefined;

      for (let page = 0; page < MAX_PAGES; page++) {
        const reply = await listSavedVideos(cursor, PAGE_SIZE);
        ids.push(...reply.videoIds);
        if (!reply.hasMore || !reply.nextCursor) break;
        cursor = reply.nextCursor;
      }
      if (!cancelled) setSavedIds(new Set(ids));
    })().catch(() => {
      // Unreadable list — the bookmarks just start empty.
    });

    return () => {
      cancelled = true;
    };
  }, [user]);

  // Gated on the session rather than cleared on sign-out: emptying the set
  // inside the effect above is a second render for a value nothing reads while
  // signed out, and the next sign-in replaces it wholesale anyway.
  const isSaved = useCallback(
    (videoId: string) => user !== null && savedIds.has(videoId),
    [savedIds, user],
  );

  const toggleSave = useCallback(
    (videoId: string) => {
      if (!requireSignIn()) return;

      const next = !savedIds.has(videoId);
      setSavedIds((current) => {
        const updated = new Set(current);
        if (next) updated.add(videoId);
        else updated.delete(videoId);
        return updated;
      });

      // Mock videos have no backend row to save; the icon still fills, which is
      // what the cloned UI did before any of this was wired up.
      if (!isBackendHandle(videoId)) return;

      (next ? saveVideo(videoId) : unsaveVideo(videoId)).catch(() => {
        setSavedIds((current) => {
          const updated = new Set(current);
          if (next) updated.delete(videoId);
          else updated.add(videoId);
          return updated;
        });
      });
    },
    [requireSignIn, savedIds],
  );

  return { isSaved, toggleSave };
}
