"use client";

import { useEffect } from "react";

import type { CommentRealtimeFrame } from "@/components/feed/comments/types";
import { getStompClient, onStompConnect } from "@/lib/realtime/stompClient";

/**
 * Subscribes to `/topic/videos.{videoId}.comments` for as long as the caller
 * is mounted with a token, handing every frame to `onFrame`.
 *
 * The comment panel is only ever mounted while it is open for one video
 * (`Feed` unmounts it on close and re-keys it per video), so a subscription
 * for the component's lifetime already means "subscribe while open" — no
 * separate flag needed. Pass a stable `onFrame`; the subscription re-binds
 * whenever it, the token or the video changes.
 *
 * `token` is read by the caller during render rather than inside this effect
 * so a rotation that lands on a re-render is a dependency the effect reacts to.
 */
export function useCommentRealtime(
  videoId: string,
  token: string | null,
  onFrame: (frame: CommentRealtimeFrame) => void,
): void {
  useEffect(() => {
    if (!token) return;

    const client = getStompClient(token);
    let subscription: { unsubscribe: () => void } | null = null;

    const subscribe = () => {
      if (!client.connected) return;
      subscription = client.subscribe(
        `/topic/videos.${videoId}.comments`,
        (message) => onFrame(JSON.parse(message.body) as CommentRealtimeFrame),
      );
    };
    subscribe();
    const unsubscribeConnect = onStompConnect(subscribe);

    return () => {
      unsubscribeConnect();
      subscription?.unsubscribe();
    };
  }, [videoId, token, onFrame]);
}
