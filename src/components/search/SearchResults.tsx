"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { PlayIcon } from "@/components/icons";
import { UserRow } from "@/components/profile/FollowListModal";
import { useSession } from "@/components/session/SessionProvider";
import { authorFromProfile } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { searchVideos } from "@/lib/api/search";
import { isLastPage } from "@/lib/api/types";
import type { UserProfileResponse, VideoSearchResponse } from "@/lib/api/types";
import { searchUsers } from "@/lib/api/users";
import { formatCount } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 24;
// ponytail: one page of accounts, most-followed first. Give `searchUsers` a
// page argument and a Load more here if 30 stops being enough.
const ACCOUNT_LIMIT = 30;

type Tab = "videos" | "accounts";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "videos", label: "Videos" },
  { id: "accounts", label: "Accounts" },
];

function searchFailure(cause: unknown): string {
  return isApiError(cause) && cause.status === 0
    ? "Can’t connect right now. Check your connection and try again."
    : "Search is unavailable right now.";
}

/**
 * `/search?q=` — video results from search-service, in the Explore grid's
 * shape; with `&tab=accounts`, the matching accounts from user-service.
 *
 * The term and the tab are read from the URL rather than held in state: the
 * search drawer navigates here, so the address bar is the one thing that says
 * what is being searched, and a shared or reloaded link has to reproduce the
 * same page.
 *
 * A leading `#` switches the request to the tag filter — see `searchParamsFor`.
 */
export function SearchResults() {
  const params = useSearchParams();
  const term = (params.get("q") ?? "").trim();
  const tab: Tab = params.get("tab") === "accounts" ? "accounts" : "videos";

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
        setError(searchFailure(cause));
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    },
    [term],
  );

  useEffect(() => {
    if (!term || tab !== "videos") return;
    void load(0);
    return () => controllerRef.current?.abort();
  }, [term, tab, load]);

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

      {term && (
        <nav className="mb-6 flex border-b border-[var(--tt-divider)]">
          {TABS.map(({ id, label }) => (
            <Link
              key={id}
              replace
              href={`/search?q=${encodeURIComponent(term)}${id === "accounts" ? "&tab=accounts" : ""}`}
              aria-current={id === tab ? "page" : undefined}
              className={cn(
                "-mb-px flex h-11 items-center border-b-2 px-8 text-[18px] leading-6 font-semibold transition-colors tt-840:px-3",
                id === tab
                  ? "border-[var(--tt-text)] text-[var(--tt-text)]"
                  : "border-transparent text-[rgb(255_255_255/0.5)] hover:text-[var(--tt-text)]",
              )}
            >
              {label}
            </Link>
          ))}
        </nav>
      )}

      {term && tab === "accounts" ? (
        <AccountResults term={term} />
      ) : (
        <>
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
        </>
      )}
    </main>
  );
}

/**
 * The Accounts tab. Account search needs a token, so a signed-out viewer
 * gets the login prompt instead of an empty list that looks like no matches.
 */
function AccountResults({ term }: { term: string }) {
  const { user, requireSignIn } = useSession();
  const signedIn = user !== null;
  const [answer, setAnswer] = useState<{ term: string; accounts: UserProfileResponse[] } | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    searchUsers(term, ACCOUNT_LIMIT, controller.signal)
      .then((page) => {
        setError(null);
        setAnswer({ term, accounts: page.content });
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(searchFailure(cause));
      });
    return () => controller.abort();
  }, [term, signedIn]);

  if (!signedIn) {
    return (
      <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
        <button type="button" onClick={requireSignIn} className="font-semibold text-[var(--tt-red)] hover:underline">
          Log in
        </button>{" "}
        to search accounts.
      </p>
    );
  }
  if (error) return <p className="pb-6 text-[15px] text-[var(--tt-red)]">{error}</p>;
  if (answer?.term !== term) {
    return <p className="py-8 text-center text-[15px] text-[var(--tt-text-muted)]">Searching…</p>;
  }
  if (answer.accounts.length === 0) {
    return (
      <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
        No accounts match “{term}”.
      </p>
    );
  }
  return (
    <div className="max-w-[680px]">
      {answer.accounts.map((account) => (
        <UserRow key={account.userId} author={authorFromProfile(account)} />
      ))}
    </div>
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
