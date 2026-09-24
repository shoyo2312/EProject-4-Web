"use client";

import { useSyncExternalStore } from "react";

import {
  getLocalSettings,
  getServerLocalSettings,
  subscribeLocalSettings,
  type LocalSettings,
} from "@/lib/settings/local-settings";

/**
 * The browser-local half of `/setting`.
 *
 * Read through `useSyncExternalStore` rather than held in React state: the
 * store lives in `localStorage`, another tab can write it, and the server
 * render has to see the defaults or hydration disagrees.
 */
export function useLocalSettings(): LocalSettings {
  return useSyncExternalStore(
    subscribeLocalSettings,
    getLocalSettings,
    getServerLocalSettings,
  );
}
