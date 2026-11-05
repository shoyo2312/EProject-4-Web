"use client";

import { useCallback, useEffect, useRef } from "react";

import { onStompDisconnect, publishStomp } from "@/lib/realtime/stompClient";
import { TYPING_HEARTBEAT_MS, TYPING_IDLE_MS } from "@/lib/typing";

/**
 * Tells the other side that the viewer is typing in `conversationId`, and when they stop.
 *
 * It is driven only by what the person does — {@link TypingSender.input} is called from the box's own
 * change handler, with whether it now holds text — never by the box merely being focused or holding a
 * draft that was put back. The text itself never leaves: the frame is `{ typing }` and nothing else.
 *
 * While input continues a frame goes out at most every {@link TYPING_HEARTBEAT_MS}, not per keystroke;
 * {@link TYPING_IDLE_MS} after the last input it stops by itself. It also stops, at once, when the box
 * empties, the message is sent, the conversation changes or the panel goes away, the tab is hidden, the
 * window loses focus, or `enabled` turns false (blocked, locked). A dropped socket forgets the state
 * without sending anything — there is nothing to send it on — and nothing is replayed after the
 * reconnect: typing starts again with the next input.
 */
export interface TypingSender {
  /** The box changed because the person did something; `hasText` is whether it now holds anything. */
  input: (hasText: boolean) => void;
  /** Stops typing now, if it was on. */
  stop: () => void;
}

export function useTypingSender(conversationId: string, enabled: boolean): TypingSender {
  const on = useRef(false);
  const lastSent = useRef(0);
  const idle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const send = useCallback(
    (typing: boolean) => publishStomp(`/app/chat.typing/${conversationId}`, { typing }),
    [conversationId],
  );

  const clearIdle = useCallback(() => {
    if (idle.current) clearTimeout(idle.current);
    idle.current = null;
  }, []);

  const stop = useCallback(() => {
    clearIdle();
    if (on.current) {
      on.current = false;
      send(false);
    }
    lastSent.current = 0;
  }, [clearIdle, send]);

  const input = useCallback(
    (hasText: boolean) => {
      if (!enabled || !hasText) {
        stop();
        return;
      }
      clearIdle();
      idle.current = setTimeout(stop, TYPING_IDLE_MS);
      const now = Date.now();
      if (!on.current || now - lastSent.current >= TYPING_HEARTBEAT_MS) {
        // Only counts as on if the frame really went out: a socket that is down says nothing.
        if (send(true)) {
          on.current = true;
          lastSent.current = now;
        }
      }
    },
    [enabled, stop, clearIdle, send],
  );

  // The conversation changed, or the thread (a closed or minimised panel) is gone.
  useEffect(() => stop, [stop]);

  useEffect(() => {
    if (!enabled) stop();
  }, [enabled, stop]);

  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") stop();
    };
    document.addEventListener("visibilitychange", onHidden);
    window.addEventListener("blur", stop);
    const offDisconnect = onStompDisconnect(() => {
      clearIdle();
      on.current = false;
      lastSent.current = 0;
    });
    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      window.removeEventListener("blur", stop);
      offDisconnect();
    };
  }, [stop, clearIdle]);

  return { input, stop };
}
