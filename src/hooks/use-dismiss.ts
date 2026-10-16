"use client";

import { useEffect, type RefObject } from "react";

import { useEscapeKey } from "@/hooks/use-escape-key";

/**
 * Closes a popover on a pointer press outside `ref` or on Escape — the one
 * dismiss rule every "⋯" menu, speed picker and composer tray shares.
 *
 * Listens on `pointerdown` rather than `click` so the menu is gone before the
 * outside element receives its own click, and only while `open`, so an idle
 * menu costs no listeners. Pass a stable `onDismiss` (a `setState` setter or a
 * `useCallback`) — the listener re-binds whenever it changes. Escape goes
 * through `useEscapeKey`, so a menu open inside a modal closes alone.
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
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [ref, open, onDismiss]);

  useEscapeKey(onDismiss, open);
}
