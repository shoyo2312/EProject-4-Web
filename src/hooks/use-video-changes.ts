"use client";

import { useEffect, useMemo, useRef } from "react";

import { useVideoRealtime } from "@/hooks/use-video-realtime";
import { isApiError } from "@/lib/api/errors";
import type { VideoResponse } from "@/lib/api/types";
import { getVideo, getVideosByIds } from "@/lib/api/videos";
import { onVideoChange } from "@/lib/video-events";

/** The batch endpoint's cap is the gateway's max page size; 50 stays under it. */
const BATCH = 50;

/**
 * Keeps a list of videos current without a reload, from three sources:
 * - this browser: a delete, pin, privacy or caption change made in any tab (`video-events`);
 * - the server: `/topic/videos.{id}`, where chat-service relays deletion, privacy, takedown and
 *   restore from any device. The frame is a hint, so the video is fetched again;
 * - coming back to the tab: one batch read of every id, for what neither of the above carries —
 *   a pin made on another device, or a socket that dropped while the tab was hidden.
 *
 * Handlers may be told about ids the caller does not hold (a change in this browser is announced
 * to everyone); replacing by id makes that a no-op.
 */
export function useVideoChanges(
  videoIds: string[],
  handlers: { onUpdated: (video: VideoResponse) => void; onDeleted: (videoId: string) => void },
): void {
  const handler = useRef(handlers);
  useEffect(() => {
    handler.current = handlers;
  });

  // A fresh array each render would re-run the subscription diff every time; the ids are the input.
  const key = videoIds.join(",");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const ids = useMemo(() => videoIds, [key]);
  const current = useRef(ids);
  useEffect(() => {
    current.current = ids;
  }, [ids]);

  useEffect(
    () =>
      onVideoChange((change) =>
        change.kind === "deleted" ? handler.current.onDeleted(change.videoId) : handler.current.onUpdated(change.video),
      ),
    [],
  );

  useVideoRealtime(ids, (frame) => {
    if (frame.type !== "state") return;
    if (frame.status === "DELETED") {
      handler.current.onDeleted(frame.videoId);
      return;
    }
    getVideo(frame.videoId)
      .then((video) => handler.current.onUpdated(video))
      .catch((cause: unknown) => {
        // Taken down, or made private to someone who is not its owner: gone from this viewer's list.
        if (isApiError(cause) && cause.status === 404) handler.current.onDeleted(frame.videoId);
      });
  });

  useEffect(() => {
    const recheck = () => {
      if (document.visibilityState !== "visible") return;
      const all = current.current;
      for (let start = 0; start < all.length; start += BATCH) {
        const chunk = all.slice(start, start + BATCH);
        getVideosByIds(chunk)
          .then((found) => {
            const present = new Set(found.map((video) => video.id));
            found.forEach((video) => handler.current.onUpdated(video));
            chunk.filter((id) => !present.has(id)).forEach((id) => handler.current.onDeleted(id));
          })
          // Offline or rate limited: the list stays as it was, and the next return tries again.
          .catch(() => {});
      }
    };
    document.addEventListener("visibilitychange", recheck);
    return () => document.removeEventListener("visibilitychange", recheck);
  }, []);
}
