"use client";

import { useCallback, useEffect, useState } from "react";

import { listStickerPacks, type StickerPack } from "@/lib/api/conversations";

type State =
  | { status: "loading" }
  | { status: "ready"; packs: StickerPack[] }
  | { status: "error" };

/** One request per tab: the catalog is the same for every conversation and changes with a deploy. */
let cached: Promise<StickerPack[]> | null = null;

function load(): Promise<StickerPack[]> {
  if (!cached) {
    cached = listStickerPacks().catch((error: unknown) => {
      cached = null; // a failure is not remembered: the next open tries again
      throw error;
    });
  }
  return cached;
}

/** Forgets the cached catalog — for tests, and for a retry that should not reuse a stale answer. */
export function resetStickerPacksCache(): void {
  cached = null;
}

/**
 * The stickers on offer, fetched the first time something asks (`enabled`: the picker is open) and
 * kept for the tab's life. `reload` is the picker's Try again.
 */
export function useStickerPacks(enabled: boolean): State & { reload: () => void } {
  const [state, setState] = useState<State>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    load().then(
      (packs) => {
        if (!cancelled) setState({ status: "ready", packs });
      },
      () => {
        if (!cancelled) setState({ status: "error" });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [enabled, attempt]);

  const reload = useCallback(() => {
    setState({ status: "loading" });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, reload };
}
