"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronRightIcon, PlayIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { useFollow } from "@/hooks/use-follow";
import { authorFromProfile, DEFAULT_AVATAR, displayHandle } from "@/lib/api/adapters";
import { resolveAuthors } from "@/lib/api/authors";
import { isApiError } from "@/lib/api/errors";
import { searchVideos } from "@/lib/api/search";
import { isLastPage } from "@/lib/api/types";
import type {
  UserProfileResponse,
  VideoResponse,
  VideoSearchResponse,
} from "@/lib/api/types";
import { searchUsers } from "@/lib/api/users";
import { getUserVideos, getUserVideoStats } from "@/lib/api/videos";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

const PAGE_SIZE = 24;
/** The Top tab shows three rows of the four-column grid, then points at the Videos tab. */
const TOP_VIDEO_COUNT = 12;
/** How many of the top account's videos the strip under their card fetches. */
const STRIP_SIZE = 10;
// ponytail: one page of accounts, most-followed first. Give `searchUsers` a
// page argument and a Load more here if 30 stops being enough.
const ACCOUNT_LIMIT = 30;

type Tab = "top" | "accounts" | "videos";
const TABS: readonly { id: Tab; label: string }[] = [
  { id: "top", label: "Top" },
  { id: "accounts", label: "Accounts" },
  { id: "videos", label: "Videos" },
];

function tabHref(term: string, tab: Tab): string {
  return `/search?q=${encodeURIComponent(term)}${tab === "top" ? "" : `&tab=${tab}`}`;
}

function searchFailure(cause: unknown): string {
  return isApiError(cause) && cause.status === 0
    ? "Can’t connect right now. Check your connection and try again."
    : "Search is unavailable right now.";
}

/**
 * `/search?q=` — laid out like tiktok.com/search (measured 2026-10): a sticky
 * tab bar over a 1056px column. **Top** stacks the best-matching account (with
 * a strip of their videos) over the first videos; **Accounts** lists the
 * matching accounts from user-service; **Videos** is the full video result
 * set from search-service, with Load more. tiktok.com's LIVE and Photos tabs
 * have no counterpart here.
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
  const requested = params.get("tab");
  const tab: Tab = requested === "accounts" || requested === "videos" ? requested : "top";

  return (
    <main className="h-screen flex-1 overflow-y-auto px-8 pb-12 tt-1024:px-4">
      <div className="mx-auto w-full max-w-[1056px]">
        {term ? (
          <>
            {/* Measured: 60px tall, text 15/20 500, 2px indicator, 1px separator at 19% white. */}
            <nav className="sticky top-0 z-10 bg-[var(--tt-page)] pt-5">
              <div className="flex border-b border-[rgb(255_255_255/0.19)] px-4">
                {TABS.map(({ id, label }) => (
                  <Link
                    key={id}
                    replace
                    href={tabHref(term, id)}
                    aria-current={id === tab ? "page" : undefined}
                    className={cn(
                      "relative flex h-10 min-w-[96px] items-center justify-center px-7 text-[15px] leading-5 font-medium transition-colors",
                      id === tab
                        ? "text-[#f6f6f6] after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-[#fafafa]"
                        : "text-[rgb(255_255_255/0.6)] hover:text-[#f6f6f6]",
                    )}
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </nav>

            {tab === "accounts" && <AccountResults term={term} />}
            {tab === "videos" && <VideoResults term={term} pageSize={PAGE_SIZE} paged />}
            {tab === "top" && (
              <>
                <TopAccount term={term} />
                <VideoResults
                  term={term}
                  pageSize={TOP_VIDEO_COUNT}
                  header={<SectionHeader title="Videos" moreHref={tabHref(term, "videos")} />}
                />
              </>
            )}
          </>
        ) : (
          <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
            Type in the search field to find videos, or start with{" "}
            <span className="font-semibold">#</span> to search one hashtag.
          </p>
        )}
      </div>
    </main>
  );
}

/** Measured: 32px row, 10px side inset, title 17/22 bold, "See more" 14/18 medium + chevron. */
function SectionHeader({ title, moreHref }: { title: string; moreHref?: string }) {
  return (
    <div className="mt-6 flex h-8 items-center justify-between px-[10px]">
      <h2 className="text-[17px] leading-[22px] font-bold text-[var(--tt-text)]">{title}</h2>
      {moreHref && (
        <Link
          replace
          href={moreHref}
          className="flex h-8 items-center gap-1 text-[14px] leading-[18px] font-medium text-[#f6f6f6] hover:underline"
        >
          See more
          <ChevronRightIcon className="h-3 w-3" />
        </Link>
      )}
    </div>
  );
}

/**
 * Video results in the measured grid: four 252px columns at full width with
 * 16px between columns and 24px between rows. `paged` adds the Load more
 * button; without it the first page is all there is (the Top tab).
 *
 * Results carry the term they answer, so a term change needs no state reset
 * in an effect: a page rendered for a stale term stops matching, and the grid
 * reads as loading until the new first page lands.
 */
function VideoResults({
  term,
  pageSize,
  paged = false,
  header,
}: {
  term: string;
  pageSize: number;
  paged?: boolean;
  header?: React.ReactNode;
}) {
  const [answer, setAnswer] = useState<{
    term: string;
    items: VideoSearchResponse[];
    page: number;
    more: boolean;
  }>({ term: "", items: [], page: 0, more: false });
  const [authors, setAuthors] = useState<Map<string, Author>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);

  // One controller for every request this grid makes: starting a search or a
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
        const result = await searchVideos(term, nextPage, pageSize, controller.signal);
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
        // Names and avatars arrive a beat after the tiles; a card draws without
        // its author line until then rather than holding the whole grid back.
        const resolved = await resolveAuthors(result.content.map((video) => video.userId));
        if (!controller.signal.aborted) {
          setAuthors((current) => new Map([...current, ...resolved]));
        }
      } catch (cause) {
        if (controller.signal.aborted) return;
        setError(searchFailure(cause));
      } finally {
        if (!controller.signal.aborted) setLoadingMore(false);
      }
    },
    [term, pageSize],
  );

  useEffect(() => {
    void load(0);
    return () => controllerRef.current?.abort();
  }, [load]);

  const fresh = answer.term === term;
  const results = fresh ? answer.items : [];
  const more = paged && fresh && answer.more;
  // The first page of the current term has not arrived and nothing failed.
  const loading = !fresh && error === null;

  return (
    <section>
      {header ?? <div className="h-6" />}

      {error && <p className="px-[10px] pb-6 text-[15px] text-[var(--tt-red)]">{error}</p>}

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4">
        {results.map((result) => (
          <VideoCard key={result.id} video={result} author={authors.get(result.userId)} />
        ))}
      </div>

      {!loading && !error && results.length === 0 && (
        <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
          No videos match “{term}”.
        </p>
      )}

      {(loading || loadingMore) && (
        <p className="py-8 text-center text-[15px] text-[var(--tt-text-muted)]">Searching…</p>
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
    </section>
  );
}

/**
 * The measured search card: a 3:4 poster (8px corners, play count in the
 * bottom-left over a gradient), one caption line, then the author's 20px
 * avatar and name with the age on the right.
 *
 * No hover preview: a search hit carries no `hlsUrl` — search-service indexes
 * what the Kafka events publish, and the playable URL is not among them.
 */
function VideoCard({ video, author }: { video: VideoSearchResponse; author?: Author }) {
  return (
    <div>
      <Link
        href={`/video/${encodeURIComponent(video.id)}`}
        onClick={() => markOverlayOrigin("/search")}
        className="relative block aspect-[3/4] overflow-hidden rounded-[8px] bg-[#252525]"
      >
        {video.thumbnailUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- any CDN URL
          <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/40 to-transparent px-3 pt-5 pb-2 text-[14px] font-semibold text-white">
          <PlayIcon className="h-3.5 w-3.5" />
          {formatCount(video.viewCount)}
        </div>
      </Link>

      <div className="px-0.5 pt-2">
        <p className="truncate text-[14px] leading-[18px] text-[var(--tt-text)]">{video.title}</p>
        <div className="mt-1.5 flex h-5 items-center">
          {author && (
            <Link
              href={`/@${author.username}`}
              className="flex min-w-0 flex-1 items-center hover:underline"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- may be a local static asset */}
              <img
                src={author.avatarUrl || DEFAULT_AVATAR}
                alt=""
                referrerPolicy="no-referrer"
                className="h-5 w-5 flex-none rounded-full object-cover"
              />
              <span className="ml-1.5 truncate text-[14px] leading-[18px] text-[rgb(255_255_255/0.88)]">
                {author.nickname}
              </span>
            </Link>
          )}
          <span className="ml-auto pl-2 text-[12px] leading-4 whitespace-nowrap text-[rgb(255_255_255/0.4)]">
            {formatRelativeTime(video.createdAt)}
          </span>
        </div>
      </div>
    </div>
  );
}

/**
 * The Top tab's lead: the most-followed account matching the term, with a
 * strip of their latest videos, as on tiktok.com. Account search needs a
 * token, so a signed-out viewer simply gets no section — the Accounts tab is
 * where they are told to log in.
 */
function TopAccount({ term }: { term: string }) {
  const { user } = useSession();
  const signedIn = user !== null;
  const [answer, setAnswer] = useState<{
    term: string;
    account: UserProfileResponse | null;
    likes: number | null;
    videos: VideoResponse[];
  } | null>(null);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    (async () => {
      try {
        const page = await searchUsers(term, 1, controller.signal);
        const account = page.content[0] ?? null;
        if (!account) {
          setAnswer({ term, account: null, likes: null, videos: [] });
          return;
        }
        // Both are decoration on the card: if either fails the card still
        // shows the account, which is the result the viewer searched for.
        const [stats, videos] = await Promise.all([
          getUserVideoStats(account.userId, controller.signal).catch(() => null),
          getUserVideos(account.userId, 0, STRIP_SIZE, controller.signal).catch(() => null),
        ]);
        if (controller.signal.aborted) return;
        setAnswer({
          term,
          account,
          likes: stats?.totalLikes ?? null,
          videos: videos?.content ?? [],
        });
      } catch {
        // A failed lookup here is a missing section, not a broken page: the
        // Accounts tab reports search errors in full.
        if (!controller.signal.aborted) setAnswer({ term, account: null, likes: null, videos: [] });
      }
    })();
    return () => controller.abort();
  }, [term, signedIn]);

  if (!signedIn || answer?.term !== term || !answer.account) return null;
  const author = authorFromProfile(answer.account);

  return (
    <section>
      <SectionHeader title="Accounts" moreHref={tabHref(term, "accounts")} />
      <div className="px-[10px] pb-3">
        <div className="flex items-center justify-between">
          <AccountIdentity
            author={author}
            account={answer.account}
            stats={[
              `${formatCount(answer.account.followerCount)} Followers`,
              ...(answer.likes === null ? [] : [`${formatCount(answer.likes)} Likes`]),
            ]}
          />
          <FollowPill author={author} />
        </div>
        {answer.videos.length > 0 && <VideoStrip videos={answer.videos} />}
      </div>
    </section>
  );
}

/**
 * Measured: 153 × 203 tiles with 8px corners, 10px apart, scrolled by a round
 * arrow at the right edge. Native horizontal scroll does the work; the arrow
 * just nudges it one viewport along.
 */
function VideoStrip({ videos }: { videos: VideoResponse[] }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div className="relative mt-2.5">
      <div ref={ref} className="no-scrollbar flex gap-2.5 overflow-x-auto scroll-smooth">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={`/video/${encodeURIComponent(video.id)}`}
            onClick={() => markOverlayOrigin("/search")}
            className="relative h-[203px] w-[153px] flex-none overflow-hidden rounded-[8px] bg-[#252525]"
          >
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- any CDN URL
              <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
          </Link>
        ))}
      </div>
      <button
        type="button"
        aria-label="Scroll videos"
        onClick={() => ref.current?.scrollBy({ left: ref.current.clientWidth })}
        className="absolute top-1/2 right-2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full bg-[rgb(0_0_0/0.6)] text-white hover:bg-[rgb(0_0_0/0.8)]"
      >
        <ChevronRightIcon className="h-3.5 w-3.5" />
      </button>
    </div>
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
  if (error) return <p className="pt-6 text-[15px] text-[var(--tt-red)]">{error}</p>;
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
    <div className="pt-6">
      {answer.accounts.map((account) => {
        const author = authorFromProfile(account);
        return (
          // Measured: 10px padding, 10px corners, hover fill; 64px avatar inside.
          <div
            key={account.userId}
            className="flex items-center justify-between rounded-[10px] p-[10px] hover:bg-[var(--tt-field)]"
          >
            {/* ponytail: followers only here — likes cost one video-service call per row, and
                a 30-row list through the gateway's per-IP limit is where that stops being free. */}
            <AccountIdentity
              author={author}
              account={account}
              stats={[`${formatCount(account.followerCount)} Followers`]}
            />
            <FollowPill author={author} />
          </div>
        );
      })}
    </div>
  );
}

/** Measured: 64px avatar, 12px gap, name 15/20 bold, handle and stats 13/17 at 88% white. */
function AccountIdentity({
  author,
  account,
  stats,
}: {
  author: Author;
  account: UserProfileResponse;
  stats: string[];
}) {
  const handle = displayHandle(author);
  return (
    <Link href={`/@${author.username}`} className="flex min-w-0 items-center gap-3">
      <StoryAvatar author={author} className="h-16 w-16">
        {/* eslint-disable-next-line @next/next/no-img-element -- may be a local static asset */}
        <img
          src={account.avatarUrl || DEFAULT_AVATAR}
          alt=""
          referrerPolicy="no-referrer"
          className="h-16 w-16 flex-none rounded-full object-cover"
        />
      </StoryAvatar>
      <div className="flex min-w-0 flex-col gap-1">
        <p className="truncate text-[15px] leading-5 font-bold text-[#f6f6f6]">{author.nickname}</p>
        {handle && (
          <p className="truncate text-[13px] leading-[17px] text-[rgb(255_255_255/0.88)]">{handle}</p>
        )}
        <p className="truncate text-[13px] leading-[17px] text-[rgb(255_255_255/0.88)]">
          {stats.join(" · ")}
        </p>
      </div>
    </Link>
  );
}

/** Measured: 96 × 32 pill, brand red, 16px medium — the search page's own Follow, not the profile's 4px one. */
function FollowPill({ author }: { author: Author }) {
  const { isSelf, following, requested, toggle } = useFollow(author.userId);
  if (isSelf) return null;
  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "ml-4 h-8 w-24 flex-none rounded-full text-[16px] font-medium transition-colors",
        following || requested
          ? "bg-[var(--tt-field)] text-[var(--tt-text)] hover:bg-[var(--tt-shape-neutral-3)]"
          : "bg-[var(--tt-red)] text-white hover:bg-[var(--tt-red-hover)]",
      )}
    >
      {following ? "Following" : requested ? "Requested" : "Follow"}
    </button>
  );
}
