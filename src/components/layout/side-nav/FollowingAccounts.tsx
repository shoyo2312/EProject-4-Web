"use client";

import Link from "next/link";
import type { ReactNode } from "react";

import { ListIcon } from "@/components/icons";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { authorFromProfile, displayHandle } from "@/lib/api/adapters";
import type { UserProfileResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";

/**
 * `.DivUserContainer` under the nav — measured on the live signed-in sidebar.
 * It takes the slot the guest's Log in button holds (`.DivPrimaryButtonContainer`,
 * 0×0 once signed in):
 *
 *   container   margin-top: 16px; padding-block: 16px; ::before the footer's hairline
 *               (left/right 8px, rgba(255,255,255,.12), scaleY(.5))
 *   heading     14px/500/18.2px, rgba(255,255,255,.88), padding 0 8px,
 *               margin-bottom 12px
 *   rows        four, 208×44 TUX secondary buttons on a 46px pitch, radius 6px,
 *               hover --ui-shape-neutral-4; content margin-left 4px, gap 12px
 *   View all    208×40, margin-top 2px; a 16px list glyph centred in 36px
 *
 * Below 1024px — and whenever the rail is held icon-only — the same list is a
 * `.DivStack` instead: the first three avatars overlapped 9px, in a 34px pill
 * (padding 2px, radius 16px) that sits 6px under More and opens the drawer,
 * exactly as View all does.
 */
export function FollowingAccounts({
  accounts,
  narrow,
  onViewAll,
}: {
  accounts: UserProfileResponse[];
  narrow: boolean;
  onViewAll: () => void;
}) {
  if (accounts.length === 0) return null;

  return (
    <>
      <div
        className={cn(
          // 16px under More is `.SubMainNavContentContainer`'s margin-top.
          "relative mt-4 py-4",
          "before:absolute before:inset-x-2 before:top-0 before:h-px",
          "before:bg-[var(--tt-divider)] before:[transform:scaleY(0.5)] before:content-['']",
          narrow ? "hidden" : "tt-1024:hidden",
        )}
      >
        <p className="mb-3 px-2 text-[14px] font-medium leading-[18.2px] text-[var(--tt-text)]">
          Following accounts
        </p>
        <ul className="flex flex-col gap-0.5">
          {accounts.slice(0, 4).map((profile) => (
            <li key={profile.userId}>
              <AccountRow profile={profile} size="rail" />
            </li>
          ))}
        </ul>
        <button
          type="button"
          onClick={onViewAll}
          className="mt-1 flex h-10 w-full items-center gap-3 rounded-[6px] pl-1 text-[14px] font-medium leading-[18.2px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
        >
          <span className="flex w-9 flex-none justify-center">
            <ListIcon className="h-4 w-4" />
          </span>
          View all
        </button>
      </div>

      <div className={cn("pt-1.5", narrow ? "flex justify-center" : "hidden tt-1024:flex tt-1024:justify-center")}>
        <button
          type="button"
          onClick={onViewAll}
          aria-label="Following accounts"
          className="flex flex-col items-center rounded-2xl p-0.5 transition-colors hover:bg-[var(--tt-field)]"
        >
          {accounts.slice(0, 3).map((profile, index) => (
            // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
            <img
              key={profile.userId}
              src={authorFromProfile(profile).avatarUrl}
              alt=""
              referrerPolicy="no-referrer"
              className={cn(
                // The 4px padding is the live avatar's own: a 28px box around
                // a 20px picture, clipped round to the content edge.
                "relative h-7 w-7 rounded-full object-cover p-1",
                index > 0 && "-mt-[9px]",
                ["z-[3]", "z-[2]", "z-[1]"][index],
              )}
            />
          ))}
        </button>
      </div>
    </>
  );
}

/**
 * One followed account, linking to its profile. `rail` is the sidebar's 44px
 * row (36px avatar box); `drawer` the panel's 68px one (56px box), which also
 * carries a trailing pill.
 */
export function AccountRow({
  profile,
  size,
  onNavigate,
  children,
}: {
  profile: UserProfileResponse;
  size: "rail" | "drawer";
  onNavigate?: () => void;
  children?: ReactNode;
}) {
  const author = authorFromProfile(profile);
  const handle = displayHandle(author);
  const drawer = size === "drawer";

  return (
    <Link
      href={`/@${author.username}`}
      onClick={onNavigate}
      className={cn(
        "flex w-full items-center rounded-[6px] transition-colors hover:bg-[var(--tt-field)]",
        drawer ? "h-[68px] pr-2" : "h-11 pr-2.5",
      )}
    >
      <span className="ml-1 flex min-w-0 flex-1 items-center gap-3">
        <StoryAvatar author={author} className={cn("ml-0.5", drawer ? "h-14 w-14" : "h-9 w-9")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed */}
          <img
            src={author.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className={cn(
              "ml-0.5 flex-none rounded-full object-cover p-1",
              drawer ? "h-14 w-14" : "h-9 w-9",
            )}
          />
        </StoryAvatar>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-[14px] font-medium leading-[18.2px] text-[var(--tt-text)]">
            {author.nickname}
          </span>
          {handle && (
            <span className="truncate text-[12px] leading-[15.6px] text-white/60">{handle}</span>
          )}
        </span>
      </span>
      {children}
    </Link>
  );
}
