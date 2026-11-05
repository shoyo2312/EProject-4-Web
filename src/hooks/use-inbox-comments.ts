"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { messageFor } from "@/lib/api/errors";
import { listInboxComments } from "@/lib/api/studio";
import type { CommentResponse } from "@/lib/api/types";

const PAGE_SIZE = 20;

/**
 * The Studio comment inbox, paged by cursor for one query (`queryKey` is its JSON).
 *
 * A cursor is only valid with the filters it was issued under, so every page of a query shares
 * that query's AbortController: changing a filter aborts the first page and any Load more still
 * in flight, and a late answer is dropped instead of being appended to the new list. Load more
 * waits until the list on screen answers the current query, and runs one page at a time.
 *
 * `rootsOnly`: keep only top-level comments (replies are read per thread).
 */
export function useInboxComments(queryKey: string, rootsOnly = false) {
  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  // Which query a Load more is running for: one left behind by a filter change blocks nothing.
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  // Two clicks in one frame both see the old state; the ref sees the first.
  const pending = useRef<AbortSignal | null>(null);

  const load = useCallback(
    (after: string | null, signal: AbortSignal) =>
      listInboxComments(JSON.parse(queryKey), after ?? undefined, PAGE_SIZE, signal).then((page) => {
        if (signal.aborted) return;
        const rows = rootsOnly ? page.items.filter((c) => c.parentId === null) : page.items;
        setComments((current) => (after ? [...(current ?? []), ...rows] : rows));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(null);
        setLoadedKey(queryKey);
      }),
    [queryKey, rootsOnly],
  );

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    load(null, current.signal).catch((cause: unknown) => {
      if (current.signal.aborted) return;
      setError(messageFor(cause));
      setLoadedKey(queryKey);
    });
    return () => current.abort();
  }, [load, queryKey]);

  const ready = loadedKey === queryKey;

  /** Resolves once the page is in; rejects only for a failure the owner should hear about. */
  const loadMore = (): Promise<void> => {
    const signal = controller.current?.signal;
    if (!signal || !ready || !cursor || pending.current === signal) return Promise.resolve();
    pending.current = signal;
    setLoadingKey(queryKey);
    return load(cursor, signal)
      .catch((cause: unknown) => {
        if (!signal.aborted) throw cause;
      })
      .finally(() => {
        if (pending.current === signal) pending.current = null;
        setLoadingKey((current) => (current === queryKey ? null : current));
      });
  };

  return {
    comments,
    setComments,
    hasMore: ready && hasMore,
    error,
    loadMore,
    loadingMore: loadingKey === queryKey,
  };
}
