import { useEffect, useRef } from "react";

import { parseFrame } from "@/hooks/use-stomp-topic";
import { subscribeTopic } from "@/lib/realtime/stompClient";

export type VideoFrame = {
  type: "counts" | "state";
  videoId: string;
  likeCount?: number;
  commentCount?: number;
  shareCount?: number;
  viewCount?: number;
  saveCount?: number;
  status?: string;
  visibility?: string;
};

/**
 * Subscribes to every video currently rendered, and drops the ones that scroll away.
 *
 * ids are strings and must stay strings: they are Snowflakes, and JSON.parse rounds a 64-bit
 * integer into a different video.
 */
export function useVideoRealtime(videoIds: string[], onFrame: (frame: VideoFrame) => void) {
  /** Video id → its unsubscribe. Reconnects are re-subscribed by `stompClient` itself. */
  const subscriptions = useRef(new Map<string, () => void>());
  const handler = useRef(onFrame);
  // Refs are only ever written from an effect or handler, never during
  // render — this keeps the closures below current without re-subscribing
  // every time the caller passes a fresh `onFrame`.
  useEffect(() => {
    handler.current = onFrame;
  });

  // Teardown lives on its own effect, run on unmount only: on the diffing
  // effect below it would drop and re-subscribe every video each time a page
  // of the feed was appended.
  useEffect(() => {
    const live = subscriptions.current;
    return () => {
      live.forEach((unsubscribe) => unsubscribe());
      live.clear();
    };
  }, []);

  useEffect(() => {
    const live = subscriptions.current;
    const wanted = new Set(videoIds);

    for (const id of wanted) {
      if (live.has(id)) continue;
      live.set(
        id,
        subscribeTopic(`/topic/videos.${id}`, (body) => {
          const frame = parseFrame<VideoFrame>(body);
          if (frame) handler.current(frame);
        }),
      );
    }
    for (const [id, unsubscribe] of live) {
      if (wanted.has(id)) continue;
      unsubscribe();
      live.delete(id);
    }
  }, [videoIds]);
}
