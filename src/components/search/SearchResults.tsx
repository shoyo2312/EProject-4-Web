"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PlayIcon } from "@/components/icons";
import { isApiError } from "@/lib/api/errors";
import { searchVideos } from "@/lib/api/search";
import { isLastPage } from "@/lib/api/types";
import type { VideoSearchResponse } from "@/lib/api/types";
import { formatCount } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";

const PAGE_SIZE = 24;

/**
 * `/search?q=` — video results from search-service, in the Explore grid's
 * shape.
 *
 * The term is read from the URL rather than held in state: the search drawer
 * navigates here, so the address bar is the one thing that says what is being
 * searched, and a shared or reloaded link has to reproduce the same page.
 *
 * A leading `#` switches the request to the tag filter — see `searchParamsFor`.
 */
export function SearchResults() {
  const term = (useSearchParams().get("q") ?? "").trim();

  /**
   * Results carry the term they answer, so a term change needs no state reset
   * in an effect: a page rendered for a stale term stops matching, and the grid
   * reads as loading until the new first page lands.
   */
  const [answer, setAnswer] = useState<{
    term: string;
    items: VideoSearchResponse[];
    page: number;
    more: boolean;
  }>({ term: "", items: [], page: 0, more: false });

  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // One controller for every request this page makes: starting a search or a
  // "Load more" aborts whatever is still in flight, so a page belonging to a
  // term the viewer has already typed past can never append itself to the list
  // rendered for the current one.
  const controllerRef = useRef<AbortController | null>(null);

  const load = useCallback(
    async (nextPage: number) => {
      controllerRef.current?.abort();
      const controller = new AbortController();
      controllerRef.current = controller;

      try {
        const result = await searchVideos(term, nextPage, PAGE_SIZE, controller.signal);
        setError(null);
        setAnswer((current) => ({
          term,
          items:
            nextPage === 0 || current.term !== term
              ? result.content
              : [...current.items, ...result.content],
          page: result.page.number,
          more: !isLastPage(result.page),
        }));
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(
          isApiError(cause) && cause.status === 0
            ? "Can\u2019t reach the API gateway on :8080."
            : "Search is unavailable right now.",
        );
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    },
    [term],
  );

  useEffect(() => {
    if (!term) return;
    void load(0);
    return () => controllerRef.current?.abort();
  }, [term, load]);

  const fresh = answer.term === term && term !== "";
  const results = fresh ? answer.items : [];
  const more = fresh && answer.more;
  // The first page of the current term has not arrived and nothing failed.
  const loading = term !== "" && !fresh && error === null;

  return (
    <main className="h-screen flex-1 overflow-y-auto px-6 pt-16 pb-12 tt-1024:px-4">
      <h1 className="pb-6 text-[20px] leading-[25px] font-bold text-[var(--tt-text)]">
        {term ? `Results for “${term}”` : "Search"}
      </h1>

      {error && (
        <p className="pb-6 text-[15px] text-[var(--tt-red)]">{error}</p>
      )}

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {results.map((result) => (
          <ResultTile key={result.id} result={result} />
        ))}
      </div>

      {!loading && !error && term && results.length === 0 && (
        <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
          No videos match “{term}”.
        </p>
      )}

      {!term && (
        <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
          Type in the search field to find videos, or start with{" "}
          <span className="font-semibold">#</span> to search one hashtag.
        </p>
      )}

      {(loading || loadingMore) && (
        <p className="py-8 text-center text-[15px] text-[var(--tt-text-muted)]">
          Searching…
        </p>
      )}

      {more && !loadingMore && (
        <div className="flex justify-center py-8">
          <button
            type="button"
            onClick={() => {
              setLoadingMore(true);
              void load(answer.page + 1);
            }}
            className="h-[42px] rounded-[8px] bg-[var(--tt-field)] px-6 text-[15px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
          >
            Load more
          </button>
        </div>
      )}
    </main>
  );
}

/**
 * The Explore tile, minus the hover preview: a search hit carries no `hlsUrl`
 * — search-service indexes what the Kafka events publish, and the playable URL
 * is not among them — so there is nothing to preview. The poster carries the
 * tile, and the detail page fetches the video itself.
 */
function ResultTile({ result }: { result: VideoSearchResponse }) {
  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/video/${encodeURIComponent(result.id)}`}
        onClick={() => markOverlayOrigin("/search")}
        className="relative block aspect-[3/4] overflow-hidden rounded-[8px] bg-[var(--tt-field)]"
      >
        {result.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- any CDN URL
          <img
            src={result.thumbnailUrl}
            alt=""
            className="h-full w-full object-cover"
          />
        )}

        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/30 to-transparent px-3 pt-5 pb-2 text-[14px] font-semibold text-white">
          <PlayIcon className="h-3.5 w-3.5" />
          {formatCount(result.viewCount)}
        </div>
      </Link>

      <p className="line-clamp-2 text-[14px] leading-[18px] text-[var(--tt-text)]">
        {result.title}
      </p>

      {result.tags.length > 0 && (
        <p className="flex flex-wrap gap-x-2 text-[13px] leading-[18px] text-[var(--tt-text-secondary)]">
          {result.tags.slice(0, 3).map((tag) => (
            <Link
              key={tag}
              href={`/search?q=${encodeURIComponent(`#${tag}`)}`}
              className="hover:underline"
            >
              #{tag}
            </Link>
          ))}
        </p>
      )}
    </div>
  );
}
