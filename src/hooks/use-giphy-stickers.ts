"use client";

import { useCallback, useEffect, useState } from "react";

import { searchGiphyStickers, type StickerView } from "@/lib/api/conversations";

type State =
  | { status: "loading" }
  | { status: "ready"; stickers: StickerView[] }
  | { status: "error" };

/**
 * GIPHY stickers for the picker: the trending ones while `query` is blank, a search otherwise.
 * `debounceMs` waits for a pause in typing, so "bunny" is one search, not five; 0 asks at once. The
 * answer is kept with the query it belongs to, so an old answer is never shown for a newer query
 * while the new one is still on its way.
 */
export function useGiphyStickers(query: string, enabled: boolean, debounceMs = 0): State & { reload: () => void } {
  const q = query.trim();
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${q}`;
  const [result, setResult] = useState<{ key: string; stickers: StickerView[] | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const run = () => {
      searchGiphyStickers(q, controller.signal).then(
        (stickers) => setResult({ key, stickers }),
        () => {
          if (!controller.signal.aborted) setResult({ key, stickers: null });
        },
      );
    };
    const timer = debounceMs > 0 ? setTimeout(run, debounceMs) : undefined;
    if (debounceMs <= 0) run();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, q, key, debounceMs]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (!result || result.key !== key) return { status: "loading", reload };
  if (!result.stickers) return { status: "error", reload };
  return { status: "ready", stickers: result.stickers, reload };
}
