"use client";

import Image from "next/image";
import Link from "next/link";
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
import { useFollow } from "@/hooks/use-follow";
import { isBackendHandle } from "@/lib/api/adapters";
import { shareVideo } from "@/lib/api/interactions";
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
  likes,
  onToggleLike,
  saved,
  saveCount,
  onToggleSave,
  compact = false,
}: {
  video: FeedVideo;
  /** Mock count plus anything the viewer posted this session. */
  commentCount: number;
  /** True when this video's comment sidebar is the one currently open. */
  commentsOpen?: boolean;
  onCommentClick?: () => void;
  /** Controlled by `Feed` so double-tapping the video updates this heart too. */
  liked: boolean;
  /**
   * The count to show, already reconciled with the server by `Feed`. Not derived
   * from `liked` here: `video.stats.likes` comes back from the API *including*
   * the viewer's own like, so adding one for a filled heart showed 2 for a video
   * one account had liked once.
   */
  likes: number;
  onToggleLike: () => void;
  /** Controlled by `Feed` so one saved-set answers every card on the page. */
  saved: boolean;
  /**
   * Authoritative total from the realtime counts frame — it already includes
   * this viewer's own save. Undefined until the first frame lands, and on a
   * mock video, where the static base plus the local toggle stands in.
   */
  saveCount?: number;
  onToggleSave: () => void;
  /**
   * The `/video/[id]` rail, measured on the live site: 32px wide instead of 48,
   * bare 20px glyphs with no circular field behind them, and no music disc —
   * it floats in the player column's right gutter, not over the media.
   */
  compact?: boolean;
}) {
  const {
    isSelf,
    following,
    toggle: toggleFollow,
  } = useFollow(video.author.userId, video.isFollowing);
  const [shareOpen, setShareOpen] = useState(false);
  const [extraShares, setExtraShares] = useState(0);

  // Opening the sheet is itself the share, on the live site as much as here —
  // there is no further "confirm" step, so it is recorded the moment the rail
  // button is tapped.
  const recordShare = () => {
    setShareOpen(true);
    setExtraShares((n) => n + 1);
    if (!isBackendHandle(video.id)) return;
    shareVideo(video.id).catch(() => setExtraShares((n) => n - 1));
  };

  return (
    <section
      className={cn(
        "flex flex-none flex-col items-center",
        compact ? "w-8 gap-0" : "w-12 gap-2",
      )}
    >
      {/* Avatar + follow badge — 48×48 with a 24×24 badge overlapping the base
          (32×32 with a 16×16 badge in the compact rail). */}
      <div className={cn("relative", compact ? "mb-2.5 h-8 w-8" : "mb-3 h-12 w-12")}>
        <Link href={`/@${video.author.username}`} aria-label={video.author.nickname}>
          <Image
            src={video.author.avatarUrl}
            alt={video.author.nickname}
            width={48}
            height={48}
            className={cn(
              "rounded-full object-cover",
              compact ? "h-8 w-8" : "h-12 w-12",
            )}
          />
        </Link>
        {/* Hidden on your own video: following yourself is not a thing the
            backend allows, and the badge would only ever error. */}
        {!isSelf && (
          <button
            type="button"
            onClick={toggleFollow}
            aria-label={
              following
                ? `Unfollow ${video.author.nickname}`
                : `Follow ${video.author.nickname}`
            }
            aria-pressed={following}
            className={cn(
              "absolute left-1/2 flex -translate-x-1/2 items-center justify-center rounded-full transition-colors duration-200",
              compact ? "-bottom-2 h-4 w-4" : "-bottom-2.5 h-6 w-6",
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
        )}
      </div>

      <RailButton
        label={formatCount(likes)}
        onClick={onToggleLike}
        active={liked}
        ariaLabel="Like"
        compact={compact}
      >
        <HeartIcon className="h-[21px] w-[21px]" />
      </RailButton>

      <RailButton
        label={video.commentsDisabled ? "" : formatCount(commentCount)}
        onClick={onCommentClick}
        active={commentsOpen}
        activeColor="text-[var(--tt-icon)]"
        ariaLabel="Comments"
        compact={compact}
      >
        <CommentIcon className="h-[21px] w-[21px]" />
      </RailButton>

      {/* The count stays the mock figure plus this viewer's own bookmark:
          video_counters has no save_count column, because a save is private
          and nothing public ever shows how many people made one. */}
      <RailButton
        label={formatCount(saveCount ?? video.stats.bookmarks + (saved ? 1 : 0))}
        onClick={onToggleSave}
        active={saved}
        activeColor="text-[#facc15]"
        ariaLabel="Bookmark"
        compact={compact}
      >
        <BookmarkIcon className="h-[21px] w-[21px]" />
      </RailButton>

      <RailButton
        label={formatCount(video.stats.shares + extraShares)}
        onClick={recordShare}
        active={shareOpen}
        activeColor="text-[var(--tt-icon)]"
        ariaLabel="Share video"
        compact={compact}
      >
        <ShareIcon className="h-[21px] w-[21px]" />
      </RailButton>

      {shareOpen && (
        <ShareSheet
          videoId={video.id}
          shares={video.stats.shares + extraShares}
          onClose={() => setShareOpen(false)}
        />
      )}

      {/* Spinning music disc — the live detail rail has none. */}
      {!compact && (
        <div className="mt-1 h-12 w-12 animate-[spin_6s_linear_infinite] rounded-full border-[6px] border-[#1f1f1f] bg-black">
          <Image
            src={video.music.coverUrl}
            alt={video.music.title}
            width={48}
            height={48}
            className="h-full w-full rounded-full object-cover"
          />
        </div>
      )}
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
  compact = false,
}: {
  children: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  activeColor?: string;
  ariaLabel: string;
  /** See `ActionRail` — 24×52 item, bare glyph, no circular field. */
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center",
        compact ? "h-[52px] w-8" : "h-[78px] w-12",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={ariaLabel}
        aria-pressed={active}
        className={cn(
          // 48×48 `.tux-interaction-container`, rgba(255,255,255,.13), 21px glyph.
          // Its :hover lives in a cross-origin TUX stylesheet that could not be
          // read; neutral-3 (.19) is a reconstruction, not an extraction.
          "flex items-center justify-center rounded-full transition-colors",
          compact
            ? "h-8 w-8 hover:opacity-80"
            : "h-12 w-12 bg-[var(--tt-field)] hover:bg-[var(--tt-shape-neutral-3)]",
          active ? activeColor : "text-[var(--tt-icon)]",
        )}
      >
        {children}
      </button>
      <strong
        className={cn(
          "font-bold text-[var(--tt-text-secondary)]",
          compact ? "text-[12px] leading-4" : "mt-1 text-[12px] leading-4",
        )}
      >
        {label}
      </strong>
    </div>
  );
}
