import { useEffect, useRef } from "react";
import type { StompSubscription } from "@stomp/stompjs";
import { getStompClient, onStompConnect } from "@/lib/realtime/stompClient";

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
export function useVideoRealtime(
  videoIds: string[],
  token: string | null,
  onFrame: (frame: VideoFrame) => void,
) {
  const subscriptions = useRef(new Map<string, StompSubscription>());
  const handler = useRef(onFrame);
  // Refs are only ever written from an effect or handler, never during
  // render — this keeps the closures below current without re-subscribing
  // every time the caller passes a fresh `onFrame`.
  useEffect(() => {
    handler.current = onFrame;
  });

  useEffect(() => {
    if (!token) {
      return;
    }
    const client = getStompClient(token);
    const live = subscriptions.current;

    const sync = () => {
      if (!client.connected) {
        return;
      }
      for (const id of videoIds) {
        if (!live.has(id)) {
          live.set(
            id,
            client.subscribe(`/topic/videos.${id}`, (message) => {
              handler.current(JSON.parse(message.body) as VideoFrame);
            }),
          );
        }
      }
      for (const [id, subscription] of live) {
        if (!videoIds.includes(id)) {
          subscription.unsubscribe();
          live.delete(id);
        }
      }
    };

    sync();
    // A reconnect invalidates every subscription, so re-subscribe rather than assume they
    // survived. `onStompConnect` composes with whatever else (e.g. the comment sheet) is also
    // listening for a (re)connect on this shared client — see `stompClient.ts`.
    const unsubscribeConnect = onStompConnect(sync);

    return () => {
      unsubscribeConnect();
      for (const [, subscription] of live) {
        subscription.unsubscribe();
      }
      live.clear();
    };
  }, [videoIds, token]);
}

/**
 * Folds a like count the client just got straight from the server into the last
 * counts frame for that video.
 *
 * The card renders `liveFrame.likeCount ?? likeCounts[id]`, and a frame is a
 * snapshot with no version to compare — so the frame that predates the like
 * response keeps winning until the next one lands (~150ms), which is the
 * 1 -> 2 -> 1 -> 2 flicker. The response is newer than any frame received
 * before it, so it replaces the stale number; every later frame still wins.
 */
export function withLikeCount(
  frames: Record<string, VideoFrame>,
  videoId: string,
  likeCount: number,
): Record<string, VideoFrame> {
  const frame = frames[videoId];
  if (!frame || frame.likeCount === likeCount) {
    return frames;
  }
  return { ...frames, [videoId]: { ...frame, likeCount } };
}
