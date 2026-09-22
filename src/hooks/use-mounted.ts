"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * `false` during SSR and hydration, `true` once the component runs in the
 * browser — for portals and anything else that needs `document`.
 *
 * `useSyncExternalStore` rather than a `useState` + `useEffect` pair: React
 * treats "mounted" as an external fact with a server snapshot of `false`, so
 * this needs no effect and trips no cascading-render lint.
 */
export function useMounted(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
