"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { ChevronRightIcon, InfoCircleIcon } from "@/components/icons";
import { StoryAvatar } from "@/components/stories/StoryAvatar";
import { Tooltip } from "@/components/ui/Tooltip";
import { useFollow } from "@/hooks/use-follow";
import { useSuggestedAccounts } from "@/hooks/use-suggested-accounts";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { scrollEdges } from "@/lib/suggested-accounts";
import { cn } from "@/lib/utils";
import type { SuggestedAccount } from "@/types/tiktok";

export const SUGGESTED_ACCOUNTS_PANEL_ID = "suggested-accounts";

const TOOLTIP =
  "Suggestions come from your connections: people who follow you, and people followed by accounts you follow. Your account can be suggested to others the same way.";

/** The edge fade, one `mask-image` per reached-end state (spec §3, 125px each side). */
const MASKS = {
  "true/true": null,
  "true/false":
    "[mask-image:linear-gradient(to_right,#000_0%,#000_calc(100%_-_125px),transparent_100%)]",
  "false/true": "[mask-image:linear-gradient(to_right,transparent_0%,#000_125px,#000_100%)]",
  "false/false":
    "[mask-image:linear-gradient(to_right,transparent_0%,#000_125px,#000_calc(100%_-_125px),transparent_100%)]",
} as const;

/**
 * `.DivUserCardListContainer` — the "Suggested accounts" row the add-friend button opens on
 * someone else's profile, copied from tiktok.com (spec §3; `docs/research/tiktok.com/PROFILE.md`).
 *
 * The wrapper is always rendered and animates `max-height`/`opacity` over 400ms `ease`. Its
 * content mounts on the first open and then stays, so closing can animate too; `inert` keeps the
 * closed panel's links and buttons out of the tab order.
 */
export function SuggestedAccountsPanel({
  open,
  excludeUserId,
  onViewAll,
}: {
  open: boolean;
  /** The profile being viewed: the endpoint is viewer-only, so its owner is dropped here. */
  excludeUserId: string;
  onViewAll: () => void;
}) {
  const [everOpened, setEverOpened] = useState(false);
  if (open && !everOpened) setEverOpened(true);

  const { accounts, isLoading, error } = useSuggestedAccounts(open, excludeUserId);

  return (
    <div
      id={SUGGESTED_ACCOUNTS_PANEL_ID}
      inert={!open}
      className={cn(
        "overflow-hidden transition-[max-height,opacity] duration-[400ms] ease-[ease]",
        open ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0",
      )}
    >
      {everOpened && (
        <div className="relative w-full pb-[15px]">
          <div className="relative z-10 flex h-10 items-center justify-between pb-2 pl-[14px]">
            <Tooltip label={TOOLTIP} variant="bubble" placement="right-start">
              {/* Focusable so a keyboard user can read the explanation too; Tooltip shows on focus. */}
              <span
                tabIndex={0}
                className="flex cursor-pointer items-center gap-2 text-[14px] leading-[18.2px] font-bold text-[rgb(255_255_255/0.6)]"
              >
                <span>Suggested accounts</span>
                <InfoCircleIcon className="h-[14px] w-[14px]" />
              </span>
            </Tooltip>
            <span className="pr-3">
              <button
                type="button"
                onClick={onViewAll}
                className="text-[13px] leading-[16.9px] font-bold text-[rgb(255_255_255/0.6)]"
              >
                View all
              </button>
            </span>
          </div>

          {isLoading ? (
            <CardRow>
              {Array.from({ length: 8 }, (_, index) => (
                <div
                  key={index}
                  className="h-[222px] w-[160px] flex-none animate-pulse rounded-[12px] bg-[#1e1e1e]"
                />
              ))}
            </CardRow>
          ) : error || accounts.length === 0 ? (
            <p className="flex h-[227px] items-center justify-center text-[14px] text-[rgb(255_255_255/0.6)]">
              {error ? "Couldn't load suggestions." : "No suggestions right now."}
            </p>
          ) : (
            <ScrollingCards accounts={accounts} />
          )}
        </div>
      )}
    </div>
  );
}

/** `.DivFadeScrollContainer` — the row itself. Zero-width ends make the 10px insets, as TikTok's do. */
function CardRow({
  children,
  rowRef,
  onScroll,
  mask,
}: {
  children: React.ReactNode;
  rowRef?: React.Ref<HTMLDivElement>;
  onScroll?: () => void;
  mask?: string | null;
}) {
  return (
    <div
      ref={rowRef}
      onScroll={onScroll}
      className={cn(
        "flex max-h-[250px] min-h-[100px] items-center gap-[10px] overflow-x-scroll pb-[5px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        mask,
      )}
    >
      <span className="w-0 flex-none" />
      {children}
      <span className="w-0 flex-none" />
    </div>
  );
}

function ScrollingCards({ accounts }: { accounts: SuggestedAccount[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    setEdges(scrollEdges(row.scrollLeft, row.clientWidth, row.scrollWidth));
  }, []);

  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure, accounts]);

  const scrollBy = (direction: 1 | -1) => {
    const row = rowRef.current;
    if (!row) return;
    row.scrollBy({ left: (direction * row.clientWidth) / 4, behavior: "smooth" });
  };

  return (
    <>
      <CardRow rowRef={rowRef} onScroll={measure} mask={MASKS[`${edges.atStart}/${edges.atEnd}`]}>
        {accounts.map((account) => (
          <Card key={account.author.userId} account={account} />
        ))}
      </CardRow>
      {!edges.atStart && <Arrow side="left" onClick={() => scrollBy(-1)} />}
      {!edges.atEnd && <Arrow side="right" onClick={() => scrollBy(1)} />}
    </>
  );
}

/** 32px circle over the row's edge; `padding: inherit` on TikTok's is the 15px top offset here. */
function Arrow({ side, onClick }: { side: "left" | "right"; onClick: () => void }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute top-0 flex h-full items-center pt-[15px] pl-[5px]",
        side === "right" ? "right-0" : "left-0",
      )}
    >
      <button
        type="button"
        aria-label={side === "right" ? "Next" : "Previous"}
        onClick={onClick}
        className={cn(
          "pointer-events-auto z-[1] flex h-8 w-8 items-center rounded-full bg-[#1e1e1e] text-[var(--tt-text)]",
          side === "right" ? "pl-[3.555px]" : "pl-[12.445px]",
        )}
      >
        <ChevronRightIcon className={cn("h-4 w-4", side === "left" && "-scale-x-100")} />
      </button>
    </div>
  );
}

/** `.DivCardContainer` — 160×222, fixed so the parts (which add up to 226) end 12px short. */
function Card({ account }: { account: SuggestedAccount }) {
  const { author, label } = account;
  const { isSelf, following, requested, toggle } = useFollow(author.userId);
  const href = `/@${author.username}`;

  return (
    <div className="flex h-[222px] w-[160px] flex-none flex-col items-center gap-[14px] rounded-[12px] bg-[#1e1e1e] p-4 hover:bg-[var(--tt-field)]">
      <StoryAvatar author={author} className="h-24 w-24">
        <Link href={href} className="block h-24 w-24 flex-none overflow-hidden rounded-full">
          {/* eslint-disable-next-line @next/next/no-img-element -- may be a local static asset */}
          <img
            src={author.avatarUrl || DEFAULT_AVATAR}
            alt=""
            referrerPolicy="no-referrer"
            className="h-24 w-24 object-cover"
          />
        </Link>
      </StoryAvatar>
      <div className="flex w-[132px] flex-col items-center gap-1">
        <Link
          href={href}
          className="w-full truncate text-center text-[14px] leading-[18.2px] font-medium text-[#fafafa]"
        >
          {author.nickname}
        </Link>
        <p className="flex h-5 w-full items-center justify-center text-[12px] leading-[15.6px] text-[rgb(255_255_255/0.6)]">
          <span className="truncate">{label}</span>
        </p>
      </div>
      {!isSelf && (
        <button
          type="button"
          onClick={toggle}
          className={cn(
            "h-7 w-[110px] flex-none rounded-full px-2 py-[1px] text-[13px] leading-[16.9px] font-medium",
            following || requested
              ? "bg-[var(--tt-field)] text-[var(--tt-text)]"
              : "bg-[var(--tt-red)] text-white",
          )}
        >
          {following ? "Following" : requested ? "Requested" : "Follow"}
        </button>
      )}
    </div>
  );
}
