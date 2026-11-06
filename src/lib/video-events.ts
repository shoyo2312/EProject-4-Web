import type { VideoResponse } from "@/lib/api/types";

/**
 * A change this browser made to one of the viewer's videos: Studio's Posts table, the profile grid
 * and the detail page each hold their own copy of a video, and without this the others only learn
 * about a delete or a pin on their next reload.
 */
export type VideoChange = { kind: "updated"; video: VideoResponse } | { kind: "deleted"; videoId: string };

type Listener = (change: VideoChange) => void;

const listeners = new Set<Listener>();
let channel: BroadcastChannel | null | undefined;

/**
 * BroadcastChannel reaches every other tab of this origin — Studio is usually open beside the app —
 * but never the tab that posted, so this one is told through `listeners`. Built lazily: this module
 * is imported during server rendering, where there is neither a channel nor anyone to tell.
 */
function tabs(): BroadcastChannel | null {
  if (channel === undefined) {
    channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel("tt:videos");
    channel?.addEventListener("message", (event: MessageEvent<VideoChange>) => {
      for (const listener of listeners) listener(event.data);
    });
  }
  return channel;
}

export function announceVideoChange(change: VideoChange): void {
  for (const listener of listeners) listener(change);
  tabs()?.postMessage(change);
}

/** Returns the unsubscribe. */
export function onVideoChange(listener: Listener): () => void {
  tabs();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
