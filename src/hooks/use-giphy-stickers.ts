"use client";

import { useCallback, useEffect, useState } from "react";

import { searchGiphyStickers, type StickerView } from "@/lib/api/conversations";

type State =
  | { status: "loading" }
  | { status: "ready"; stickers: StickerView[] }
  | { status: "error" };

/** A pause after the last keystroke, so typing "bunny" is one search, not five. */
const DEBOUNCE_MS = 350;

/**
 * GIPHY stickers for the picker: the trending ones while `query` is blank, a search otherwise. The
 * answer is kept with the query it belongs to, so an old answer is never shown for a newer query
 * while the new one is still on its way.
 */
export function useGiphyStickers(query: string, enabled: boolean): State & { reload: () => void } {
  const q = query.trim();
  const [attempt, setAttempt] = useState(0);
  const key = `${attempt}:${q}`;
  const [result, setResult] = useState<{ key: string; stickers: StickerView[] | null } | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        searchGiphyStickers(q, controller.signal).then(
          (stickers) => setResult({ key, stickers }),
          () => {
            if (!controller.signal.aborted) setResult({ key, stickers: null });
          },
        );
      },
      q ? DEBOUNCE_MS : 0,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, q, key]);

  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  if (!result || result.key !== key) return { status: "loading", reload };
  if (!result.stickers) return { status: "error", reload };
  return { status: "ready", stickers: result.stickers, reload };
}
