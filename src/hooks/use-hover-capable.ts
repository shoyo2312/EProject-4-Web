"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(hover: hover)";

function subscribe(onChange: () => void) {
  const query = window.matchMedia(QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

/**
 * Whether the primary pointer can hover — `false` on touch screens, where an
 * affordance revealed only on hover would never be reachable at all.
 *
 * The server snapshot is `true` so the desktop markup hydrates without a flash
 * of the touch fallback; a phone reveals the fallback on its first commit.
 */
export function useHoverCapable(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => true,
  );
}
