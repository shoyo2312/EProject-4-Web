"use client";

import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

const GAP = 6;
const EDGE = 8;

/**
 * Where to put a `position: fixed` popover next to its trigger: right edges aligned, below it, or
 * above when there is no room below, and always inside the viewport. Fixed coordinates are what keep
 * the popover from being clipped by a scrolling list or a panel with `overflow: hidden` around the
 * trigger — which is also why it closes, instead of floating loose, when the page scrolls or resizes.
 *
 * Null until the popover has been measured once; render it hidden until then.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  popover: RefObject<HTMLElement | null>,
  open: boolean,
  onClose: () => void,
): { left: number; top: number } | null {
  const [place, setPlace] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const button = anchor.current?.getBoundingClientRect();
    const box = popover.current?.getBoundingClientRect();
    if (!button || !box) return;
    const left = Math.min(Math.max(EDGE, button.right - box.width), window.innerWidth - box.width - EDGE);
    const below = button.bottom + GAP;
    const top =
      below + box.height <= window.innerHeight - EDGE
        ? below
        : Math.max(EDGE, button.top - box.height - GAP);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the position needs the popover's own measured size
    setPlace({ left, top });
  }, [anchor, popover, open]);

  useEffect(() => {
    if (!open) return;
    window.addEventListener("resize", onClose);
    window.addEventListener("scroll", onClose, true);
    return () => {
      window.removeEventListener("resize", onClose);
      window.removeEventListener("scroll", onClose, true);
    };
  }, [open, onClose]);

  return open ? place : null;
}
