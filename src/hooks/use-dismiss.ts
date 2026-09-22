"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes a popover on a pointer press outside `ref` or on Escape — the one
 * dismiss rule every "⋯" menu, speed picker and composer tray shares.
 *
 * Listens on `pointerdown` rather than `click` so the menu is gone before the
 * outside element receives its own click, and only while `open`, so an idle
 * menu costs no listeners. Pass a stable `onDismiss` (a `setState` setter or a
 * `useCallback`) — the listeners re-bind whenever it changes.
 */
export function useDismiss(
  ref: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onDismiss();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [ref, open, onDismiss]);
}
