"use client";

import { useEffect, useState } from "react";

import { resolveAuthors } from "@/lib/api/authors";
import { getFeed } from "@/lib/api/videos";
import { pickSuggestedCreators } from "@/lib/creators/suggested";
import type { SuggestedCreator } from "@/types/tiktok";

/** How deep into the feed to look for distinct creators to offer. */
const SCAN_SIZE = 60;

export interface SuggestedCreatorsState {
  creators: SuggestedCreator[];
  isLoading: boolean;
  error: unknown;
}

/**
 * The creator grid `/following` and `/friends` fall back to, built from the
 * public feed — see `lib/creators/suggested.ts` for why there is no endpoint to
 * ask instead.
 *
 * `exclude` is the viewer plus everyone they already follow: offering someone a
 * Follow button for an account they follow is the one thing this grid must not
 * do. It is passed in rather than fetched because the caller has already walked
 * the follow graph to build the feed that came back empty.
 */
export function useSuggestedCreators(
  exclude: readonly string[] = [],
  limit = 12,
): SuggestedCreatorsState {
  const [creators, setCreators] = useState<SuggestedCreator[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);

  // Joined so the effect re-runs on a changed follow graph, not on every render
  // that rebuilds the caller's array.
  const excludeKey = exclude.join(",");

  useEffect(() => {
    const controller = new AbortController();

    const load = async () => {
      const page = await getFeed(undefined, SCAN_SIZE, controller.signal);
      const authors = await resolveAuthors(
        page.items.map((video) => video.userId),
      );
      return pickSuggestedCreators(page.items, authors, {
        exclude: excludeKey ? excludeKey.split(",") : [],
        limit,
      });
    };

    load()
      .then((cards) => {
        if (controller.signal.aborted) return;
        setCreators(cards);
        setError(null);
      })
      .catch((cause) => {
        if (controller.signal.aborted) return;
        setCreators([]);
        setError(cause);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [excludeKey, limit]);

  return { creators, isLoading, error };
}
