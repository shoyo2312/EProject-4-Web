"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import {
  authorFromProfile,
  DEFAULT_AVATAR,
  displayHandle,
} from "@/lib/api/adapters";
import { isApiError, messageFor } from "@/lib/api/errors";
import { isLastPage } from "@/lib/api/types";
import type { UserProfileResponse } from "@/lib/api/types";
import { getBlocked, getMuted, unblock, unmute } from "@/lib/api/users";
import { cn } from "@/lib/utils";

/** One page of `GET /users/me/blocked` or `/muted`, and the ceiling on a skeleton run. */
const PAGE_SIZE = 20;

type ListKind = "blocked" | "muted";

/** What differs between the two lists: where they come from and how a row is lifted. */
const KINDS = {
  blocked: {
    title: "Blocked accounts",
    list: getBlocked,
    release: unblock,
    verb: ["Unblock", "Unblocking…"],
    gone: "NOT_BLOCKED",
    empty: "You haven’t blocked anyone.",
  },
  muted: {
    title: "Muted accounts",
    list: getMuted,
    release: unmute,
    verb: ["Unmute", "Unmuting…"],
    gone: "NOT_MUTED",
    empty: "You haven’t muted anyone.",
  },
} as const;

/**
 * Privacy → "Blocked accounts" and "Muted accounts": the viewer's own list of
 * either, each row with the button that lifts it. user-service already had
 * both lists and both undos; nothing called them.
 *
 * Styled as `FollowListModal` is — the same 500 × 640 sheet, the same paged
 * list — because it is the same kind of dialog and the live site draws it that
 * way.
 */
export function AccountListModal({ kind, onClose }: { kind: ListKind; onClose: () => void }) {
  useEscapeKey(onClose);
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef, mounted);

  if (!mounted) return null;

  return (
    <div className="fixed inset-0 z-[3001] flex items-center justify-center">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-black/[0.68]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={KINDS[kind].title}
        className="relative flex h-[640px] max-h-[calc(100vh-2rem)] w-[500px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-[8px] bg-[#121212] shadow-[0_2px_12px_rgba(0,0,0,0.12)]"
      >
        <div className="flex flex-none items-center border-b border-white/20 px-4">
          <h2 className="flex-1 py-4 text-[18px] leading-[27px] font-semibold text-[var(--tt-text)]">
            {KINDS[kind].title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-8 w-8 flex-none items-center justify-center text-[var(--tt-text)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <AccountList kind={kind} />
      </div>
    </div>
  );
}

function AccountList({ kind }: { kind: ListKind }) {
  const [rows, setRows] = useState<UserProfileResponse[]>([]);
  const [page, setPage] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadMore = useCallback(async (pageToLoad: number) => {
    setLoading(true);
    setError(null);
    try {
      const result = await KINDS[kind].list(pageToLoad, PAGE_SIZE);
      setRows((current) => [...current, ...result.content]);
      setDone(isLastPage(result.page));
      setPage(pageToLoad + 1);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [kind]);

  const startedRef = useRef(false);
  useEffect(() => {
    // StrictMode fires this twice on mount; without the guard page 0 loads
    // twice and every row in it renders with a duplicate React key.
    if (startedRef.current) return;
    startedRef.current = true;
    loadMore(0);
  }, [loadMore]);

  const remove = useCallback((userId: string) => {
    setRows((current) => current.filter((row) => row.userId !== userId));
  }, []);

  if (error && rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6">
        <p className="text-center text-[14px] text-[var(--tt-red-active)]">
          {error}
        </p>
        <button
          type="button"
          onClick={() => loadMore(0)}
          className="text-[14px] font-semibold text-[var(--tt-text)] hover:text-[var(--tt-red)]"
        >
          Try again
        </button>
      </div>
    );
  }

  if (loading && rows.length === 0) {
    return (
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="flex items-center gap-3 px-4 py-2">
            <div className="h-11 w-11 flex-none animate-pulse rounded-full bg-[var(--tt-field)]" />
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-[15px] w-2/5 animate-pulse rounded bg-[var(--tt-field)]" />
              <div className="h-[14px] w-1/3 animate-pulse rounded bg-[var(--tt-field)]" />
            </div>
            <div className="h-8 w-20 flex-none animate-pulse rounded-[4px] bg-[var(--tt-field)]" />
          </div>
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center px-6">
        <p className="text-center text-[14px] text-[var(--tt-text-secondary)]">
          {KINDS[kind].empty}
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto py-2">
      {/* The contract is explicit that unblocking does not restore the follow
          edges blocking tore down, and that a UI which stays quiet about it
          gets read as a bug. Muting never touched them. */}
      {kind === "blocked" && (
        <p className="px-4 pt-1 pb-3 text-[12px] leading-[16px] text-[var(--tt-text-muted)]">
          Unblocking doesn’t restore a follow. If you followed each other before,
          you’ll both need to follow again.
        </p>
      )}

      {rows.map((row) => (
        <AccountRow key={row.userId} kind={kind} profile={row} onReleased={remove} />
      ))}

      {error && (
        <p className="px-4 py-2 text-[13px] text-[var(--tt-red-active)]">{error}</p>
      )}

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

function AccountRow({
  kind,
  profile,
  onReleased,
}: {
  kind: ListKind;
  profile: UserProfileResponse;
  onReleased: (userId: string) => void;
}) {
  const { release, verb, gone } = KINDS[kind];
  const author = authorFromProfile(profile);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState<string | null>(null);

  const onRelease = async () => {
    setPending(true);
    setFailed(null);
    try {
      await release(profile.userId);
      onReleased(profile.userId);
    } catch (cause) {
      // `NOT_BLOCKED`/`NOT_MUTED` is the server agreeing the row should not be
      // here — lifted on another device, most likely. Drop it rather than
      // report a failure the viewer cannot act on.
      if (isApiError(cause) && cause.is(gone)) {
        onReleased(profile.userId);
        return;
      }
      setFailed(messageFor(cause));
      setPending(false);
    }
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2">
      {/* A blocked account's profile is 404 to us, so this links nowhere the
          viewer can go until they unblock; the row is a plain <div> and only
          the handle is a link, which still resolves once the block is gone. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- may be a local static asset */}
      <img
        src={author.avatarUrl || DEFAULT_AVATAR}
        alt=""
        referrerPolicy="no-referrer"
        className="h-11 w-11 flex-none rounded-full object-cover"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-[var(--tt-text)]">
          {author.nickname}
        </p>
        {displayHandle(author) && (
          <Link
            href={`/@${author.username}`}
            className="block truncate text-[14px] text-[var(--tt-text-secondary)] hover:underline"
          >
            @{displayHandle(author)}
          </Link>
        )}
        {failed && (
          <p className="mt-0.5 text-[12px] text-[var(--tt-red-active)]">{failed}</p>
        )}
      </div>

      <button
        type="button"
        onClick={onRelease}
        disabled={pending}
        className={cn(
          "h-8 flex-none rounded-[4px] px-4 text-[14px] font-semibold transition-colors",
          "bg-[var(--tt-field)] text-[var(--tt-text)] hover:bg-[var(--tt-shape-neutral-3)]",
          "disabled:opacity-60",
        )}
      >
        {pending ? verb[1] : verb[0]}
      </button>
    </div>
  );
}
