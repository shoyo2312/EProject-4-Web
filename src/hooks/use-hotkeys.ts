"use client";

import { useEffect, useRef } from "react";

/** Where a keystroke is text, not a command. */
const TYPING = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';
/** Where Space already means "press this" — handling it too would act twice. */
const PRESSABLE = 'button, a[href], [role="button"], [role="slider"], [role="switch"], [role="menuitem"]';

/**
 * Single-key shortcuts on the page behind every dialog. `bindings` maps a key
 * — lowercase for letters, `" "` for Space, `"ArrowUp"` and the like — to what
 * it does, and is read through a ref, so a fresh object each render is fine.
 *
 * A key is left alone while the viewer types, while any modal is open, and
 * with a modifier held (Cmd+L is the browser's, not ours).
 */
export function useHotkeys(bindings: Record<string, () => void>, enabled = true): void {
  const latest = useRef(bindings);
  useEffect(() => {
    latest.current = bindings;
  });

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest(TYPING)) return;
      if (event.key === " " && target?.closest(PRESSABLE)) return;
      if (document.querySelector('[aria-modal="true"]')) return;

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key;
      const action = latest.current[key];
      if (!action) return;
      event.preventDefault();
      action();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
