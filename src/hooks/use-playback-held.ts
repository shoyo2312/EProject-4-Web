"use client";

import { useSyncExternalStore } from "react";

import { playbackHeld, subscribePlaybackHold } from "@/lib/playback-hold";

/** Whether something covering the app is holding every player still. Never on the server. */
export function usePlaybackHeld(): boolean {
  return useSyncExternalStore(subscribePlaybackHold, playbackHeld, () => false);
}
