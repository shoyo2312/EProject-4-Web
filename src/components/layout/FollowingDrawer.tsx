"use client";

import { useEffect, useRef } from "react";

import { CloseIcon } from "@/components/icons";
import { AccountRow } from "@/components/layout/side-nav/FollowingAccounts";
import { useEscapeKey } from "@/hooks/use-escape-key";
import type { FollowingAccountsState } from "@/hooks/use-following-accounts";
import { cn } from "@/lib/utils";

/**
 * The sidebar's Following accounts panel, opened by View all (or the avatar
 * stack in the icon-only rail), in the slot beside the rail that Activity,
 * Search and More use. Measured on the live one:
 *
 *   `.DivUserContainer`  flex column, gap 16px, padding 24px 0 0 8px
 *   heading              20px/700/25px, #F6F6F6, padding 0 8px
 *   close                28×28 circle, --ui-shape-neutral-4, 16px glyph,
 *                        16px from the right edge, 24px from the top
 *   rows                 296×68, radius 6px; 56px avatar box (48px picture);
 *                        a 64×28 "View" pill, 13px/500, margin-left 5.5px
 *
 * The list is the whole following list, paged in by a sentinel after its last
 * row as it scrolls into view.
 */
export function FollowingDrawer({
  open,
  following,
  onClose,
}: {
  open: boolean;
  following: FollowingAccountsState;
  onClose: () => void;
}) {
  const { accounts, loadMore } = following;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEscapeKey(onClose, open);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    // Only while open: the closed panel is translated, not unmounted, and its
    // last 8px still overlap the viewport, which would page in the whole list.
    if (!open || !sentinel || !loadMore) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) loadMore();
      },
      { rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [open, loadMore, accounts.length]);

  return (
    <>
      {open && (
        <button
          type="button"
          aria-label="Close following accounts"
          onClick={onClose}
          className="fixed top-0 left-[calc(20rem+4.5rem)] z-[99] h-screen w-screen cursor-default"
        />
      )}

      <div
        inert={!open || undefined}
        className={cn(
          // The same panel as `ActivityDrawer` — see there for the measurements.
          "fixed top-0 z-[1] h-screen w-80 overscroll-contain bg-[var(--tt-page)]",
          "left-18 border-x border-[var(--tt-divider)]",
          "transition-[transform,opacity,visibility] duration-[400ms] ease-[ease]",
          open
            ? "visible opacity-100 [transform:translateX(0)]"
            : "invisible opacity-30 [transform:translateX(-24rem)] [pointer-events:none]",
        )}
      >
        <div className="absolute end-4 top-6 z-[1] flex items-center justify-center">
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex h-full flex-col gap-4 pt-6 pl-2">
          <h2 className="px-2 text-[20px] font-bold leading-[25px] text-[var(--tt-icon)]">
            Following accounts
          </h2>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            <ul className="flex flex-col">
              {accounts.map((profile) => (
                <li key={profile.userId} className="pr-1.5">
                  <AccountRow profile={profile} size="drawer" onNavigate={onClose}>
                    <span className="ml-[5.5px] flex h-7 min-w-16 flex-none items-center justify-center rounded-full bg-[var(--tt-field)] px-2 text-[13px] font-medium leading-[16.9px] text-[var(--tt-icon)]">
                      View
                    </span>
                  </AccountRow>
                </li>
              ))}
            </ul>
            <div ref={sentinelRef} aria-hidden className="h-px" />
          </div>
        </div>
      </div>
    </>
  );
}
