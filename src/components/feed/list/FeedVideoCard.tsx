"use client";

import { ActionRail } from "@/components/feed/ActionRail";
import { VideoCard } from "@/components/feed/VideoCard";
import { useHotkeys } from "@/hooks/use-hotkeys";
import { useVideoLike } from "@/hooks/use-video-like";
import type { VideoFrame } from "@/hooks/use-video-realtime";
import type { LikeStatusResponse } from "@/lib/api/types";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/types/tiktok";

/**
 * One card + its action rail. Pulled out of `Feed`'s `.map` because the heart
 * lives behind `useVideoLike` — a hook, which cannot be called a variable
 * number of times inside a loop in the parent's own render. Each mounted
 * instance owns exactly one call, so the feed's length can change across
 * renders without breaking the rules of hooks.
 */
export function FeedVideoCard({
  video,
  index,
  activeIndex,
  isActive,
  commentsOpen,
  commentCount,
  liveFrame,
  serverLiked,
  serverLikeCount,
  onLikeConfirmed,
  onActive,
  onEnded,
  onCommentClick,
  saved,
  onToggleSave,
}: {
  video: FeedVideo;
  index: number;
  activeIndex: number;
  /** The card on screen — the one L likes. */
  isActive: boolean;
  /** True when this video's comment sidebar is the one currently open. */
  commentsOpen: boolean;
  /** The server's count plus anything the viewer posted this session or the server broadcast. */
  commentCount: number;
  /** Latest `counts` realtime frame for this video, if one has arrived. */
  liveFrame?: VideoFrame;
  /** The viewer's like as the server last confirmed it. */
  serverLiked: boolean;
  /** The server's latest like count, before this card's own pending tap. */
  serverLikeCount: number;
  onLikeConfirmed: (status: LikeStatusResponse) => void;
  onActive: () => void;
  onEnded?: () => void;
  onCommentClick: () => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const { liked, likeCount, toggleLike, likeOnly } = useVideoLike({
    videoId: video.id,
    serverLiked,
    serverCount: serverLikeCount,
    onConfirmed: onLikeConfirmed,
  });
  useHotkeys({ l: toggleLike }, isActive);

  const displayComments = liveFrame?.commentCount ?? commentCount;

  return (
    <article
      className={cn(
        // Live site uses the two-axis value `start center` (block/inline).
        "relative flex snap-always items-center justify-center gap-4 overflow-hidden py-4",
        "[scroll-snap-align:start_center]",
        "[min-height:calc(100vh-var(--one-column-top-content-height)-var(--one-column-item-bottom-content-height))]",
        "mx-auto transition-[margin,height,width,padding] duration-300 ease-[var(--tt-ease)]",
        commentsOpen
          ? // With the sidebar open the live site swaps in an emotion class
            // whose only padding declaration is `padding-inline: 1rem` — all
            // four breakpoint branches below collapse into it.
            "[padding-inline:1rem]"
          : [
              // >1280 — mirrors the base rule on the live site
              "[padding-inline-start:calc(var(--feed-nav-button-width)+1rem)]",
              "[padding-inline-end:calc(15rem-var(--feed-nav-button-width)-1rem)]",
              // <=1280
              "tt-1280:[padding-inline-start:1rem]",
              "tt-1280:[padding-inline-end:calc(15rem-(var(--feed-nav-button-width)*2)-1rem)]",
              // <=1024
              "tt-1024:[padding-inline-start:var(--feed-nav-button-width)]",
              "tt-1024:[padding-inline-end:1rem]",
              // <=768
              "tt-768:[padding-inline:1rem]",
            ].join(" "),
      )}
    >
      {/*
       * `.DivContentFlexLayout` — full article content width, centred,
       * 16px gap; the card grows into it and its own max-width decides
       * where it stops. Cross-axis alignment is the one thing that
       * differs by orientation, measured live at 1920×936:
       *   portrait  align-items: end     rail bottom-aligned  (y 1476)
       *   landscape align-items: center  rail centred         (y 252)
       */}
      <div
        className={cn(
          // `min-w-0`: without it this row's automatic minimum is the
          // card's min-content, which the feed column cannot shrink
          // past — that is what put a horizontal scrollbar on the page
          // between 1025px and 1083px with the comment sidebar open.
          "flex w-full min-w-0 flex-1 justify-center gap-4",
          video.width > video.height ? "items-center" : "items-end",
        )}
      >
        <VideoCard
          video={video}
          distance={index - activeIndex}
          onLike={likeOnly}
          onActive={onActive}
          // The feed's counterpart to auto scroll on `/video/[id]`:
          // there, finishing a clip navigates to the next video; here
          // it scrolls the snap container on by one card. Passing this
          // also turns `loop` off, which is what lets `ended` fire.
          onEnded={onEnded}
        />
        <ActionRail
          video={video}
          commentCount={displayComments}
          commentsOpen={commentsOpen}
          onCommentClick={onCommentClick}
          liked={liked}
          likes={likeCount}
          onToggleLike={toggleLike}
          saved={saved}
          saveCount={liveFrame?.saveCount}
          onToggleSave={onToggleSave}
        />
      </div>
    </article>
  );
}
