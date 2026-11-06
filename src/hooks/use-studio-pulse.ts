"use client";

import { useEffect, useLayoutEffect, useRef } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { useStompTopic } from "@/hooks/use-stomp-topic";

/**
 * How long after a frame Studio asks analytics-service again: the like or follow behind it has to
 * reach ClickHouse first (a Kafka poll waits up to 1s), and outlive analytics-service's 2s memo of
 * the answer the page already has.
 */
export const PULSE_SETTLE_MS = 3_000;

/**
 * Calls `onPulse` once a frame lands on `destination` — `/topic/users.{me}` moves when someone
 * likes one of my posts or follows me, `/topic/videos.{id}` when that post's counters move. A
 * burst of frames is one call, `settleMs` after the first of them.
 */
export function useStudioPulse(destination: string | null, onPulse: () => void, settleMs = PULSE_SETTLE_MS) {
  const handler = useRef(onPulse);
  useLayoutEffect(() => {
    handler.current = onPulse;
  });
  const pending = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (pending.current !== null) window.clearTimeout(pending.current);
    },
    [],
  );

  useStompTopic(destination, () => {
    if (pending.current !== null) return;
    pending.current = window.setTimeout(() => {
      pending.current = null;
      handler.current();
    }, settleMs);
  });
}

/** `useStudioPulse` on the signed-in creator's own topic. */
export function useMyStudioPulse(onPulse: () => void, settleMs = PULSE_SETTLE_MS) {
  const { user } = useSession();
  useStudioPulse(user ? `/topic/users.${user.userId}` : null, onPulse, settleMs);
}
