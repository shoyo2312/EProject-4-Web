"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * Every enabled handler, oldest first. Only the last one answers a press: a
 * login modal opened over the share sheet, or a menu open inside a modal, is
 * what the viewer means to close — one Escape used to close every layer at once.
 */
const stack: RefObject<() => void>[] = [];

function onKeyDown(event: KeyboardEvent): void {
  if (event.key === "Escape") stack[stack.length - 1]?.current();
}

/**
 * Calls `onEscape` when the Escape key is pressed anywhere in the document,
 * unless something enabled later is on top of it.
 *
 * `enabled` lets a drawer that stays mounted while closed (see `SearchDrawer`)
 * opt out without unmounting, and is what places the handler: it goes on top
 * when it is enabled. `onEscape` is read through a ref, so a fresh callback
 * each render neither re-binds nor moves it.
 */
export function useEscapeKey(onEscape: () => void, enabled = true): void {
  const handler = useRef(onEscape);
  useEffect(() => {
    handler.current = onEscape;
  });

  useEffect(() => {
    if (!enabled) return;
    if (stack.length === 0) document.addEventListener("keydown", onKeyDown);
    stack.push(handler);
    return () => {
      stack.splice(stack.lastIndexOf(handler), 1);
      if (stack.length === 0) document.removeEventListener("keydown", onKeyDown);
    };
  }, [enabled]);
}
