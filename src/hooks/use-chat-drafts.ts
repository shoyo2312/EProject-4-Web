"use client";

import { useSyncExternalStore } from "react";

import { draftsSnapshot, subscribeDrafts } from "@/lib/chat-drafts";

const NONE = {};

/** The signed-in account's unsent texts by conversation id; re-renders when any of them changes. */
export function useChatDrafts(userId: string): Readonly<Record<string, string>> {
  return useSyncExternalStore(
    subscribeDrafts,
    () => draftsSnapshot(userId),
    () => NONE,
  );
}
