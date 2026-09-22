"use client";

import { useEffect } from "react";

/**
 * Calls `onEscape` when the Escape key is pressed anywhere in the document.
 *
 * `enabled` lets a drawer that stays mounted while closed (see `SearchDrawer`)
 * opt out without unmounting; the listener is only attached while it is true.
 * Pass a stable callback — the listener is re-bound whenever it changes.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onEscape();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onEscape, enabled]);
}
