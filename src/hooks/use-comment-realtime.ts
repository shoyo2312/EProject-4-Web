"use client";

import type { CommentRealtimeFrame } from "@/components/feed/comments/types";
import { useStompTopic } from "@/hooks/use-stomp-topic";

/**
 * Subscribes to `/topic/videos.{videoId}.comments` while `enabled` (signed in),
 * handing every frame to `onFrame`.
 *
 * The comment panel is only ever mounted while it is open for one video
 * (`Feed` unmounts it on close and re-keys it per video), so a subscription
 * for the component's lifetime already means "subscribe while open" — no
 * separate flag needed.
 */
export function useCommentRealtime(
  videoId: string,
  enabled: boolean,
  onFrame: (frame: CommentRealtimeFrame) => void,
): void {
  useStompTopic(enabled ? `/topic/videos.${videoId}.comments` : null, onFrame);
}
