"use client";

import { useCallback, useEffect, useState } from "react";

import { fetchChatImage, type ImageView } from "@/lib/api/conversations";

/** Object URLs for pictures already fetched, oldest first; the oldest are released past this many. */
const CACHE_LIMIT = 60;
const cache = new Map<string, string>();

function remember(url: string, objectUrl: string) {
  cache.set(url, objectUrl);
  while (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    const stale = cache.get(oldest);
    cache.delete(oldest);
    if (stale) URL.revokeObjectURL(stale);
  }
}

export type ChatImageState =
  | { status: "loading"; src: null }
  | { status: "ready"; src: string }
  | { status: "error"; src: null };

/**
 * A chat picture as something an `<img>` can show. The server serves it only to people in the
 * conversation, so it is fetched with the viewer's token and handed over as an object URL.
 */
export function useChatImage(image: Pick<ImageView, "url"> | null | undefined): ChatImageState & { retry: () => void } {
  const url = image?.url ?? null;
  const [attempt, setAttempt] = useState(0);
  const [state, setState] = useState<{ url: string | null; attempt: number; result: ChatImageState }>({
    url: null,
    attempt: 0,
    result: { status: "loading", src: null },
  });

  useEffect(() => {
    if (!url) return;
    const cached = cache.get(url);
    if (cached) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a cache hit is read from outside React
      setState({ url, attempt, result: { status: "ready", src: cached } });
      return;
    }
    const controller = new AbortController();
    fetchChatImage(url, controller.signal).then(
      (blob) => {
        if (controller.signal.aborted) return;
        const objectUrl = URL.createObjectURL(blob);
        remember(url, objectUrl);
        setState({ url, attempt, result: { status: "ready", src: objectUrl } });
      },
      () => {
        if (!controller.signal.aborted) setState({ url, attempt, result: { status: "error", src: null } });
      },
    );
    return () => controller.abort();
  }, [url, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current: ChatImageState =
    state.url === url && state.attempt === attempt ? state.result : { status: "loading", src: null };
  return { ...current, retry };
}
