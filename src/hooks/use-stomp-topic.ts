"use client";

import { useEffect, useRef } from "react";

import { subscribeTopic } from "@/lib/realtime/stompClient";

/**
 * Hands every JSON frame on `destination` to `onFrame` while mounted; `null` listens to nothing
 * (signed out, or nothing to watch yet). Reconnects and token rotation are the shared client's
 * job — see `stompClient.ts` — so a subscription here survives both.
 *
 * `onFrame` is read through a ref, so a fresh callback each render does not re-subscribe.
 */
export function useStompTopic<T>(destination: string | null, onFrame: (frame: T) => void): void {
  const handler = useRef(onFrame);
  useEffect(() => {
    handler.current = onFrame;
  });

  useEffect(() => {
    if (!destination) return;
    return subscribeTopic(destination, (body) => {
      const frame = parseFrame<T>(body);
      if (frame !== undefined) handler.current(frame);
    });
  }, [destination]);
}

/** A malformed frame is dropped rather than thrown inside stompjs's message loop. */
export function parseFrame<T>(body: string): T | undefined {
  try {
    return JSON.parse(body) as T;
  } catch {
    return undefined;
  }
}
