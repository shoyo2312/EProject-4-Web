"use client";

import { useSyncExternalStore } from "react";

/**
 * How often "seen 13 minutes ago" is looked at again. The label changes on the minute, so this is how late
 * it can be: five seconds at most. One timer however many labels there are, and only while one is on screen.
 */
export const SHARED_NOW_TICK_MS = 5_000;

let now = 0;
let timer: ReturnType<typeof setInterval> | null = null;
const listeners = new Set<() => void>();

function refresh() {
  now = Date.now();
  for (const listener of listeners) listener();
}

/** The tab coming back is when a stale label would show, so it is worked out again at once. */
function onShown() {
  if (document.visibilityState === "visible") refresh();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = setInterval(refresh, SHARED_NOW_TICK_MS);
    document.addEventListener("visibilitychange", onShown);
    window.addEventListener("focus", onShown);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (timer) clearInterval(timer);
      timer = null;
      document.removeEventListener("visibilitychange", onShown);
      window.removeEventListener("focus", onShown);
    }
  };
}

/**
 * The current time, shared: one interval for the whole page however many components read it — never
 * one per bubble — that ticks while at least one is mounted and also fires when the tab is shown again.
 */
export function useSharedNow(): number {
  return useSyncExternalStore(subscribe, () => (now === 0 ? (now = Date.now()) : now), () => 0);
}
