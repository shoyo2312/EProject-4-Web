"use client";

import { useEffect, useRef, type RefObject } from "react";

import type { MessageResponse } from "@/lib/api/conversations";

/** A message counts as in view when this much of it is, or this many pixels — a tall one never has half. */
const MIN_RATIO = 0.5;
const MIN_PIXELS = 120;

/**
 * Which of the other side's messages is on screen, newest first: reports the id of the newest one in
 * `scroller`'s viewport (or null), whenever that changes.
 *
 * It is the browser's own answer, from an IntersectionObserver on the rendered rows — this effect runs
 * after React has committed them, so nothing can be reported before it has been drawn, and it does not
 * depend on a remembered "at the bottom" flag. Whether the tab is shown and the window focused is not
 * known here; the caller combines that with what this reports.
 */
export function useVisiblePeerMessage(
  scroller: RefObject<HTMLElement | null>,
  messages: readonly MessageResponse[],
  me: string,
  onChange: ((messageId: string | null) => void) | undefined,
): void {
  const callback = useRef(onChange);
  useEffect(() => {
    callback.current = onChange;
  });
  const reported = useRef<string | null>(null);

  useEffect(() => {
    const root = scroller.current;
    if (!root || typeof IntersectionObserver === "undefined") return;
    const peerIds = messages.filter((m) => m.senderId !== me).map((m) => m.id);
    const visible = new Set<string>();

    const report = () => {
      let newest: string | null = null;
      for (let i = peerIds.length - 1; i >= 0; i -= 1) {
        if (visible.has(peerIds[i])) {
          newest = peerIds[i];
          break;
        }
      }
      if (newest !== reported.current) {
        reported.current = newest;
        callback.current?.(newest);
      }
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.id;
          if (!id) continue;
          const inView =
            entry.isIntersecting &&
            (entry.intersectionRatio >= MIN_RATIO || entry.intersectionRect.height >= MIN_PIXELS);
          if (inView) visible.add(id);
          else visible.delete(id);
        }
        report();
      },
      { root, threshold: [0, MIN_RATIO, 1] },
    );
    for (const id of peerIds) {
      const row = root.querySelector<HTMLElement>(`[data-id="${id}"]`);
      if (row) observer.observe(row);
    }
    return () => observer.disconnect();
  }, [scroller, messages, me]);
}
