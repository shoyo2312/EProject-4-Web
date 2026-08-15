"use client";

import Image from "next/image";
import { useState } from "react";

import {
  BookmarkIcon,
  CheckIcon,
  CommentIcon,
  HeartIcon,
  PlusIcon,
  ShareIcon,
} from "@/components/icons";
import { ShareSheet } from "@/components/feed/ShareSheet";
import { useSession } from "@/components/session/SessionProvider";
import { cn } from "@/lib/utils";
import { formatCount } from "@/lib/format";
import type { FeedVideo } from "@/types/tiktok";

/**
 * `section.SectionActionBarContainer` — 48px wide, bottom-aligned in the
 * article's flex row. Each item is 48×78: a 48×48 circular icon button plus a
 * 12px/700/16px count in rgba(255,255,255,.75).
 */
export function ActionRail({
  video,
  commentCount,
  commentsOpen = false,
  onCommentClick,
  liked,
  onToggleLike,
}: {
  video: FeedVideo;
  /** Mock count plus anything the viewer posted this session. */
  commentCount: number;
  /** True when this video's comment sidebar is the one currently open. */
  commentsOpen?: boolean;
  onCommentClick?: () => void;
  /** Controlled by `Feed` so double-tapping the video updates this heart too. */
  liked: boolean;
  onToggleLike: () => void;
}) {
  const [bookmarked, setBookmarked] = useState(false);
  const [following, setFollowing] = useState(video.isFollowing);
  const [shareOpen, setShareOpen] = useState(false);

  // Following and bookmarking both need an account; sharing does not, and the
  // comment button only opens a panel a guest is allowed to read.
  const { requireSignIn } = useSession();

  return (
    <section className="flex w-12 flex-none flex-col items-center gap-2">
      {/* Avatar + follow badge — 48×48 with a 24×24 badge overlapping the base */}
      <div className="relative mb-3 h-12 w-12">
        <Image
          src={video.author.avatarUrl}
          alt={video.author.nickname}
          width={48}
          height={48}
          className="h-12 w-12 rounded-full object-cover"
        />
        <button
          type="button"
          onClick={() => {
            if (!requireSignIn()) return;
            setFollowing((prev) => !prev);
          }}
          aria-label={
            following
              ? `Unfollow ${video.author.nickname}`
              : `Follow ${video.author.nickname}`
          }
          aria-pressed={following}
          className={cn(
            "absolute -bottom-2.5 left-1/2 flex h-6 w-6 -translate-x-1/2 items-center justify-center rounded-full transition-colors duration-200",
            following
              ? "bg-white hover:bg-white/85"
              : "bg-[var(--tt-red)] hover:bg-[var(--tt-red-hover)]",
          )}
        >
          {/* Key swaps the node so the icon replays its pop-in on every toggle. */}
          <span
            key={following ? "following" : "follow"}
            className="flex animate-[tt-badge-pop_200ms_ease-out] items-center justify-center"
          >
            {following ? (
              <CheckIcon className="h-3.5 w-3.5 text-[var(--tt-red)]" />
            ) : (
              <PlusIcon className="h-3.5 w-3.5 text-white" />
            )}
          </span>
        </button>
      </div>

      <RailButton
        label={formatCount(video.stats.likes + (liked ? 1 : 0))}
        onClick={onToggleLike}
        active={liked}
        ariaLabel="Like"
      >
        <HeartIcon className="h-[21px] w-[21px]" />
      </RailButton>

      <RailButton
        label={formatCount(commentCount)}
        onClick={onCommentClick}
        active={commentsOpen}
        activeColor="text-[var(--tt-icon)]"
        ariaLabel="Comments"
      >
        <CommentIcon className="h-[21px] w-[21px]" />
      </RailButton>

      <RailButton
        label={formatCount(video.stats.bookmarks)}
        onClick={() => {
          if (!requireSignIn()) return;
          setBookmarked((v) => !v);
        }}
        active={bookmarked}
        activeColor="text-[#facc15]"
        ariaLabel="Bookmark"
      >
        <BookmarkIcon className="h-[21px] w-[21px]" />
      </RailButton>

      <RailButton
        label={formatCount(video.stats.shares)}
        onClick={() => setShareOpen(true)}
        active={shareOpen}
        activeColor="text-[var(--tt-icon)]"
        ariaLabel="Share video"
      >
        <ShareIcon className="h-[21px] w-[21px]" />
      </RailButton>

      {shareOpen && (
        <ShareSheet
          shares={video.stats.shares}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Spinning music disc */}
      <div className="mt-1 h-12 w-12 animate-[spin_6s_linear_infinite] rounded-full border-[6px] border-[#1f1f1f] bg-black">
        <Image
          src={video.music.coverUrl}
          alt={video.music.title}
          width={48}
          height={48}
          className="h-full w-full rounded-full object-cover"
        />
      </div>
    </section>
  );
}

function RailButton({
  children,
  label,
  onClick,
  active = false,
  activeColor = "text-[var(--tt-red)]",
  ariaLabel,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  activeColor?: string;
  ariaLabel: string;
}) {
  return (
    <div className="flex h-[78px] w-12 flex-col items-center">
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={cn(
          // 48×48 `.tux-interaction-container`, rgba(255,255,255,.13), 21px glyph.
          // Its :hover lives in a cross-origin TUX stylesheet that could not be
          // read; neutral-3 (.19) is a reconstruction, not an extraction.
          "flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tt-field)] transition-colors",
          "hover:bg-[var(--tt-shape-neutral-3)]",
          active ? activeColor : "text-[var(--tt-icon)]",
        )}
      >
        {children}
      </button>
      <strong className="mt-1 text-[12px] font-bold leading-4 text-[var(--tt-text-secondary)]">
        {label}
      </strong>
    </div>
  );
}
