"use client";

import { useEffect, type RefObject } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Open dialogs, oldest first. Only the top one keeps Tab — the same rule as `useEscapeKey`. */
const stack: RefObject<HTMLElement | null>[] = [];

function onKeyDown(event: KeyboardEvent): void {
  const dialog = stack[stack.length - 1]?.current;
  if (event.key !== "Tab" || !dialog) return;

  const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE));
  const first = items[0];
  const last = items[items.length - 1];
  const active = document.activeElement;
  const outside = !dialog.contains(active);

  if (!first) {
    event.preventDefault();
    dialog.focus();
  } else if (event.shiftKey && (outside || active === first || active === dialog)) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && (outside || active === last)) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * Keeps keyboard focus inside a modal while it is mounted: focus moves into it
 * on open (unless a field there already took it with `autoFocus`), Tab and
 * Shift+Tab cycle through its controls, and focus goes back to whatever opened
 * it on close.
 *
 * `active` is for a dialog that is not in the DOM on its first render (one
 * gated on `useMounted`), or one still on screen while it animates out.
 */
export function useFocusTrap(ref: RefObject<HTMLElement | null>, active = true): void {
  useEffect(() => {
    const dialog = ref.current;
    if (!active || !dialog) return;

    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!dialog.contains(document.activeElement)) {
      if (!dialog.hasAttribute("tabindex")) dialog.setAttribute("tabindex", "-1");
      dialog.focus({ preventScroll: true });
    }

    if (stack.length === 0) document.addEventListener("keydown", onKeyDown);
    stack.push(ref);
    return () => {
      stack.splice(stack.lastIndexOf(ref), 1);
      if (stack.length === 0) document.removeEventListener("keydown", onKeyDown);
      opener?.focus({ preventScroll: true });
    };
  }, [ref, active]);
}
