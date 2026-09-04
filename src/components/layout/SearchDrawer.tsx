"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ClockIcon, CloseIcon, DotIcon, SearchIcon, TrendingIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { searchUsers } from "@/lib/api/users";
import type { UserProfileResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/** How long the field sits still before it asks the server. */
const SEARCH_DEBOUNCE_MS = 250;

/**
 * Where the viewer's own recent searches live. The live site keeps this
 * server-side, per account; there is no such endpoint here, so it is the one
 * piece of this panel that is deliberately local to the browser.
 */
const HISTORY_KEY = "nowa:search-history";
const HISTORY_LIMIT = 8;

/**
 * Suggestions under "You may like". The live panel is fed by TikTok's own
 * trending index — ours is a fixed list of our own terms, and stays a constant
 * until there is a trending endpoint to read.
 */
const SUGGESTIONS: readonly { term: string; trending?: boolean }[] = [
  { term: "dance challenge", trending: true },
  { term: "street food tour", trending: true },
  { term: "study with me", trending: true },
  { term: "gym motivation" },
  { term: "cat compilation" },
  { term: "acoustic covers" },
  { term: "phone photography tips" },
  { term: "one pan dinners" },
];

function readHistory(): string[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === "string") : [];
  } catch {
    // Private mode, or somebody put something else under the key. Either way
    // the panel opens with an empty history rather than not opening at all.
    return [];
  }
}

function writeHistory(terms: string[]): void {
  try {
    localStorage.setItem(HISTORY_KEY, JSON.stringify(terms));
  } catch {
    // Storage full or blocked — the in-memory list still drives this session.
  }
}

/**
 * The search panel, opened by the sidebar's search field.
 *
 * `.DivDrawerContainer`, extracted from the live search drawer:
 *
 *   --drawer-animation-duration: 200ms;
 *   --drawer-animation-easing: cubic-bezier(.25, 0, .25, 1);
 *   --drawer-animation-delay: 200ms;
 *   width: var(--drawer-content-width, 20rem);   → 320px
 *   height: 100vh; position: fixed; top: 0;
 *   inset-inline-start: 4.5rem;                  → 72px, beside the collapsed rail
 *   background-color: var(--ui-page-flat-1); z-index: 98;
 *   border-inline-end: 1px solid var(--ui-shape-neutral-3);
 *
 *   .drawer-enter        { transform: translateX(-24rem); opacity: .3 }
 *   .drawer-enter-active { transform: translateX(0); opacity: 1;
 *                          transition-delay: 200ms }
 *   .drawer-exit-active  { transform: translateX(-24rem); opacity: .3;
 *                          transition: transform 200ms …, opacity 200ms … }
 *
 * The entrance delay is not decoration: the rail's own rows slide out first,
 * and the panel arrives into the space that just opened rather than crossing
 * it. Closing has no delay — the panel leaves, then the rail refills.
 *
 * `.DivDrawerMask` is the click-catcher to the right of the panel:
 *   inset-inline-start: calc(var(--drawer-content-width) + 4.5rem);
 *   100vw × 100vh; z-index: 99.
 */
export function SearchDrawer({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  const { user } = useSession();
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [results, setResults] = useState<UserProfileResponse[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();

  // Read on the first open rather than on mount, and during render rather than
  // in an effect: `localStorage` does not exist in the server render, so the
  // list has to start empty on both sides of hydration and fill in only once a
  // click has proved we are in a browser.
  if (open && !loaded) {
    setLoaded(true);
    setHistory(readHistory());
  }

  useEffect(() => {
    if (!open) return;
    // Focus lands after the whole 200ms delay + 200ms slide, and with
    // `preventScroll`: focusing an element inside a still-transforming panel
    // makes the browser scroll it into view, which reads as a jolt halfway
    // through the animation.
    const timer = setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 420);
    return () => clearTimeout(timer);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    // user-service has no public read, so there is nothing to ask for signed out.
    if (!user || term.length === 0) return;

    const controller = new AbortController();
    // Debounced, and the in-flight request is aborted when the next keystroke
    // lands: without it every character is a request, and the answers can
    // arrive out of order and leave the list showing results for a prefix the
    // viewer has already typed past.
    const timer = setTimeout(() => {
      searchUsers(term, 8, controller.signal)
        .then((page) => setResults(page.content))
        .catch(() => {
          // Aborted, or the call failed — the previous list stays.
        });
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [term, user, open]);

  /**
   * Submitting the field is a video search, not an account one: the accounts
   * list below answers as you type, while videos live behind
   * `GET /search/videos`, which is paged and belongs on its own route. A term
   * starting with `#` searches that one hashtag — see `searchParamsFor`.
   */
  const submit = useCallback(
    (value: string) => {
      const entry = value.trim();
      if (!entry) return;
      router.push(`/search?q=${encodeURIComponent(entry)}`);
      onClose();
    },
    [router, onClose],
  );

  const remember = useCallback((value: string) => {
    const entry = value.trim();
    if (!entry) return;
    setHistory((current) => {
      const next = [entry, ...current.filter((t) => t !== entry)].slice(0, HISTORY_LIMIT);
      writeHistory(next);
      return next;
    });
  }, []);

  const forget = useCallback((value: string) => {
    setHistory((current) => {
      const next = current.filter((t) => t !== value);
      writeHistory(next);
      return next;
    });
  }, []);

  const showLists = term.length === 0;

  return (
    <>
      {/* The mask sits beside the panel, not over it, exactly as the live one
          does: the first click anywhere in the feed closes the panel. */}
      {open && (
        <button
          type="button"
          aria-label="Close search"
          onClick={onClose}
          className="fixed top-0 left-[calc(20rem+4.5rem)] z-[99] h-screen w-screen cursor-default"
        />
      )}

      <div
        aria-hidden={!open}
        className={cn(
          // z-1 puts the panel *under* the sidebar's animation cover. That is what
          // keeps the slide from reading as a pane flying across the search
          // field: the cover is an opaque 200px band that retracts to 4.5rem
          // over 400ms, so the panel travels hidden behind it and is uncovered
          // exactly at its resting edge, x = 72.
          "fixed top-0 left-18 z-[1] h-screen w-80 overscroll-contain bg-[var(--tt-page)]",
          "border-r border-[var(--tt-divider)] px-2 pt-16",
          // `transform`, not Tailwind's `translate-x-*`: in v4 those compile to
          // the `translate` property, which `transition-[transform]` does not
          // cover — the slide would snap while opacity eased.
          "transition-[transform,opacity,visibility] duration-200 ease-[cubic-bezier(.25,0,.25,1)]",
          open
            ? "visible opacity-100 delay-200 [transform:translateX(0)]"
            : "invisible opacity-30 [transform:translateX(calc(-100%-3rem))] [pointer-events:none]",
        )}
      >
        {/* `.DivSearchDriverHeader`: absolute, top 8px, height 4.5rem,
            padding-top 1rem, padding-inline 8px. */}
        <div className="absolute inset-x-0 top-2 h-18 px-2 pt-4">
          <h2 className="text-[20px] leading-[25px] font-bold text-[var(--tt-text)]">Search</h2>
          {/* 28 × 28, rgba(255,255,255,.13), radius 999px, 16px from the end. */}
          <button
            type="button"
            aria-label="Close search"
            onClick={onClose}
            className="absolute end-4 top-4 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-text)] transition-colors hover:bg-[rgb(255_255_255/0.2)]"
          >
            <CloseIcon className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* `.FormElement`: padding 10px 4px 10px 16px, background
            rgba(255,255,255,.12), radius 92px, margin-inline-end 8px. */}
        <form
          onSubmit={(event) => {
            event.preventDefault();
            remember(term);
            submit(term);
          }}
          className="me-2 flex items-center rounded-[92px] bg-[var(--tt-field)] py-2.5 ps-4 pe-1"
        >
          <SearchIcon className="h-4 w-4 flex-none text-[var(--tt-placeholder)]" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search"
            aria-label="Search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="mx-2 w-full bg-transparent text-[14px] leading-[21px] text-[var(--tt-text)] placeholder:text-[var(--tt-placeholder)] focus:outline-none"
          />
          {query.length > 0 && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[var(--tt-placeholder)] transition-colors hover:text-[var(--tt-text)]"
            >
              <CloseIcon className="h-3.5 w-3.5" />
            </button>
          )}
        </form>

        {/* `.UlContainer` starts 14px under the field and scrolls on its own. */}
        <div className="no-scrollbar mt-3.5 h-[calc(100vh-7.25rem)] overflow-y-auto">
          {showLists ? (
            <>
              {history.length > 0 && (
                <ul>
                  <ListHeader>Recent searches</ListHeader>
                  {history.map((entry) => (
                    <Row
                      key={entry}
                      icon={<ClockIcon className="h-4 w-4 text-[rgb(255_255_255/0.34)]" />}
                      label={entry}
                      onSelect={() => {
                        setQuery(entry);
                        submit(entry);
                      }}
                      onRemove={() => forget(entry)}
                    />
                  ))}
                </ul>
              )}

              <ul>
                <ListHeader>You may like</ListHeader>
                {SUGGESTIONS.map((suggestion) => (
                  <Row
                    key={suggestion.term}
                    icon={
                      suggestion.trending ? (
                        <TrendingIcon className="h-4 w-4 text-[var(--tt-red)]" />
                      ) : (
                        <DotIcon className="h-4 w-4 text-[rgb(255_255_255/0.34)]" />
                      )
                    }
                    label={suggestion.term}
                    onSelect={() => {
                      setQuery(suggestion.term);
                      remember(suggestion.term);
                      submit(suggestion.term);
                    }}
                  />
                ))}
              </ul>
            </>
          ) : (
            <ul>
              <Row
                icon={<SearchIcon className="h-4 w-4 text-[rgb(255_255_255/0.34)]" />}
                label={term.startsWith("#") ? `Videos tagged ${term}` : `Videos for “${term}”`}
                onSelect={() => {
                  remember(term);
                  submit(term);
                }}
              />

              <ListHeader>Accounts</ListHeader>
              {results.length === 0 || !user ? (
                <li className="px-4 py-2 text-[14px] text-[var(--tt-text-secondary)]">
                  {user ? "No accounts found" : "Log in to search"}
                </li>
              ) : (
                results.map((result) => (
                  <li key={result.userId}>
                    {/* Addressed by id: a handle only identifies an account to
                        auth-service, so `/@<id>` is the one profile URL that
                        always resolves — see ProfileRouter. */}
                    <Link
                      href={`/@${result.userId}`}
                      onClick={() => {
                        remember(term);
                        onClose();
                      }}
                      className="flex items-center gap-3 px-4 py-2 hover:bg-[rgb(255_255_255/0.08)]"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL */}
                      <img
                        src={result.avatarUrl || DEFAULT_AVATAR}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 flex-none rounded-full object-cover"
                      />
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[var(--tt-text)]">
                          {result.displayName ?? result.username ?? "Unknown"}
                        </span>
                        <span className="block truncate text-[13px] text-[var(--tt-text-secondary)]">
                          {result.username ? `@${result.username}` : " "}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))
              )}
            </ul>
          )}
        </div>
      </div>
    </>
  );
}

/** `.DivHeader`: 14px/22px/600, rgba(255,255,255,.75), padding 5px 12px 3px. */
function ListHeader({ children }: { children: React.ReactNode }) {
  return (
    <li className="px-3 pt-[5px] pb-[3px] text-[14px] leading-[22px] font-semibold text-[rgb(255_255_255/0.75)]">
      {children}
    </li>
  );
}

/**
 * `.LiItemContainer`: padding 9px 16px, 42px tall, with `.H4ItemText` at
 * 16px/24px/600 and 8px/12px of inline padding around it.
 */
function Row({
  icon,
  label,
  onSelect,
  onRemove,
}: {
  icon: React.ReactNode;
  label: string;
  onSelect: () => void;
  onRemove?: () => void;
}) {
  return (
    <li className="flex items-center px-4 py-[9px] hover:bg-[rgb(255_255_255/0.08)]">
      <button
        type="button"
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center text-start"
      >
        <span className="flex-none">{icon}</span>
        <span className="truncate ps-2 pe-3 text-[16px] leading-[24px] font-semibold text-[var(--tt-text)]">
          {label}
        </span>
      </button>
      {onRemove && (
        <button
          type="button"
          aria-label={`Remove ${label} from recent searches`}
          onClick={onRemove}
          className="flex-none text-[rgb(255_255_255/0.34)] transition-colors hover:text-[var(--tt-text)]"
        >
          <CloseIcon className="h-3 w-3" />
        </button>
      )}
    </li>
  );
}
