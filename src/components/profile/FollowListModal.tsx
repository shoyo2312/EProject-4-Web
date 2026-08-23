"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { useFollow } from "@/hooks/use-follow";
import { authorFromProfile, DEFAULT_AVATAR } from "@/lib/api/adapters";
import { messageFor } from "@/lib/api/errors";
import { isLastPage } from "@/lib/api/types";
import type { PageResponse, UserProfileResponse } from "@/lib/api/types";
import * as usersApi from "@/lib/api/users";
import { SUGGESTED_CREATORS } from "@/lib/mock-feed";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

export type FollowTab = "followers" | "following" | "friends" | "suggested";

const TABS: { id: FollowTab; label: string }[] = [
  { id: "followers", label: "Followers" },
  { id: "following", label: "Following" },
  { id: "friends", label: "Friends" },
  { id: "suggested", label: "Suggested" },
];

/**
 * The Followers/Following list, opened by clicking either stat on
 * `ProfileHeader`. Two extra tabs live in the same dialog: Friends (the
 * target's mutual follows) and Suggested — grouped in one dialog rather than
 * one modal per stat.
 */
export function FollowListModal({
  targetUserId,
  initialTab,
  onClose,
}: {
  targetUserId: string;
  initialTab: FollowTab;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<FollowTab>(initialTab);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[3001] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-black/[0.68]"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label="Followers and following"
        className="relative flex h-[640px] max-h-full w-[500px] max-w-full flex-col overflow-hidden rounded-[8px] bg-[#121212] shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-none items-center border-b border-white/20 pl-2">
          {TABS.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => setTab(entry.id)}
              className={cn(
                "relative h-14 flex-1 text-[15px] font-semibold text-[var(--tt-text-secondary)] transition-colors hover:text-[var(--tt-text)]",
                tab === entry.id && "text-[var(--tt-text)]",
              )}
            >
              {entry.label}
              {tab === entry.id && (
                <span className="absolute inset-x-4 bottom-0 h-[2px] rounded-full bg-[var(--tt-text)]" />
              )}
            </button>
          ))}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mr-3 flex h-8 w-8 flex-none items-center justify-center text-[var(--tt-text)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {tab === "followers" && (
            <FollowingList
              key="followers"
              fetchPage={(page) => usersApi.getFollowers(targetUserId, page)}
              emptyLabel="No followers yet."
            />
          )}
          {tab === "following" && (
            <FollowingList
              key="following"
              fetchPage={(page) => usersApi.getFollowing(targetUserId, page)}
              emptyLabel="Not following anyone yet."
            />
          )}
          {tab === "friends" && <FriendsList targetUserId={targetUserId} />}
          {tab === "suggested" && <SuggestedList />}
        </div>
      </div>
    </div>
  );
}

function FollowingList({
  fetchPage,
  emptyLabel,
}: {
  fetchPage: (page: number) => Promise<PageResponse<UserProfileResponse>>;
  emptyLabel: string;
}) {
  const [rows, setRows] = useState<UserProfileResponse[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(
    async (pageToLoad: number) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchPage(pageToLoad);
        setRows((current) => [...current, ...result.content]);
        setDone(isLastPage(result.page));
        setPage(pageToLoad + 1);
      } catch (cause) {
        setError(messageFor(cause));
      } finally {
        setLoading(false);
      }
    },
    [fetchPage],
  );

  const startedRef = useRef(false);
  useEffect(() => {
    // StrictMode fires this effect twice on mount; without the guard, page 0
    // loads twice and every row in it renders with a duplicate React key.
    if (startedRef.current) return;
    startedRef.current = true;
    loadMore(0);
    // Only on mount for this tab — `fetchPage` is a fresh closure per render,
    // and re-running on every one of those would refetch page 0 forever.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return <p className="p-6 text-[14px] text-[var(--tt-red-active)]">{error}</p>;
  }
  if (!loading && rows.length === 0) {
    return (
      <p className="p-6 text-[14px] text-[var(--tt-text-secondary)]">{emptyLabel}</p>
    );
  }

  return (
    <div className="py-2">
      {rows.map((row) => (
        <UserRow key={row.userId} author={authorFromProfile(row)} />
      ))}
      {!done && (
        <button
          type="button"
          onClick={() => loadMore(page)}
          disabled={loading}
          className="w-full py-3 text-center text-[14px] font-semibold text-[var(--tt-text-secondary)] hover:text-[var(--tt-text)] disabled:opacity-60"
        >
          {loading ? "Loading…" : "Load more"}
        </button>
      )}
    </div>
  );
}

/**
 * Mutual follows of the *profile being viewed*, not the viewer — the target
 * follows them back and they follow the target. There is no dedicated
 * endpoint for this, so it is computed here by intersecting the target's own
 * followers and following lists.
 *
 * ponytail: capped at 10 pages (500 rows) per side to bound the walk; a
 * target with more connections than that gets a partial intersection. Add a
 * real backend endpoint if that ceiling ever matters.
 */
function FriendsList({ targetUserId }: { targetUserId: string }) {
  const [rows, setRows] = useState<UserProfileResponse[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [followers, following] = await Promise.all([
          fetchAllPages((page) => usersApi.getFollowers(targetUserId, page)),
          fetchAllPages((page) => usersApi.getFollowing(targetUserId, page)),
        ]);
        const followingIds = new Set(following.map((user) => user.userId));
        const mutual = followers.filter((user) => followingIds.has(user.userId));
        if (!cancelled) setRows(mutual);
      } catch (cause) {
        if (!cancelled) setError(messageFor(cause));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [targetUserId]);

  if (error) {
    return <p className="p-6 text-[14px] text-[var(--tt-red-active)]">{error}</p>;
  }
  if (rows === null) {
    return (
      <p className="p-6 text-[14px] text-[var(--tt-text-secondary)]">Loading…</p>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="p-6 text-[14px] text-[var(--tt-text-secondary)]">
        No mutual friends yet.
      </p>
    );
  }

  return (
    <div className="py-2">
      {rows.map((row) => (
        <UserRow key={row.userId} author={authorFromProfile(row)} />
      ))}
    </div>
  );
}

async function fetchAllPages(
  fetchPage: (page: number) => Promise<PageResponse<UserProfileResponse>>,
  maxPages = 10,
): Promise<UserProfileResponse[]> {
  const all: UserProfileResponse[] = [];
  for (let page = 0; page < maxPages; page += 1) {
    const result = await fetchPage(page);
    all.push(...result.content);
    if (isLastPage(result.page)) break;
  }
  return all;
}

/**
 * There is no user-suggestion endpoint on the backend — recommendation-service
 * only ranks the video feed. This reuses the same invented creators as the
 * `/following` empty state so the tab has something to show.
 */
function SuggestedList() {
  return (
    <div className="py-2">
      {SUGGESTED_CREATORS.map((creator) => (
        <UserRow
          key={creator.id}
          author={creator.author}
          initialFollowing={creator.isFollowing}
        />
      ))}
    </div>
  );
}

function UserRow({
  author,
  initialFollowing = false,
}: {
  author: Author;
  initialFollowing?: boolean;
}) {
  const { isSelf, following, toggle } = useFollow(author.userId, initialFollowing);

  return (
    <Link
      href={`/@${author.username}`}
      className="flex items-center gap-3 px-4 py-2 hover:bg-white/[0.03]"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- may be a local static asset */}
      <img
        src={author.avatarUrl || DEFAULT_AVATAR}
        alt=""
        className="h-11 w-11 flex-none rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[var(--tt-text)]">
          {author.username}
        </p>
        <p className="truncate text-[14px] text-[var(--tt-text-secondary)]">
          {author.nickname}
        </p>
      </div>
      {!isSelf && (
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault();
            toggle();
          }}
          className={cn(
            "h-8 flex-none rounded-[4px] px-4 text-[14px] font-semibold transition-colors",
            following
              ? "bg-[var(--tt-field)] text-[var(--tt-text)] hover:bg-[var(--tt-shape-neutral-3)]"
              : "bg-[var(--tt-red-active)] text-white hover:bg-[var(--tt-red)]",
          )}
        >
          {following ? "Following" : "Follow"}
        </button>
      )}
    </Link>
  );
}
