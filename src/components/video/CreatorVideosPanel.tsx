"use client";

import { forwardRef, useEffect, useRef, useState } from "react";

import { ArrowPostIcon, PlayIcon } from "@/components/icons";
import { getUserVideos } from "@/lib/api/videos";
import type { VideoResponse } from "@/lib/api/types";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * The "Creator videos" tab beside Comments on `/video/[id]`.
 *
 * Measured on the live site (1920-wide window): a two-column grid inside the
 * 460px side panel — 210×314 cards, 8px gutters, a 40px play-count strip along
 * each card's bottom edge, and the card being watched wearing a "Now playing"
 * mask instead of its count. That mask is the point of the tab: it is the only
 * place the page says *where in the creator's catalogue you are*.
 *
 * The same listing the profile grid uses, so the order agrees with it.
 */
export function CreatorVideosPanel({
  userId,
  currentVideoId,
  onSelect,
}: {
  userId: string;
  currentVideoId: string;
  /** Swaps the open video, the way the up/down controls do. */
  onSelect: (videoId: string) => void;
}) {
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const playingRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const controller = new AbortController();
    getUserVideos(userId, 0, 30, controller.signal)
      .then((page) => setVideos(page.content))
      .catch(() => {
        // Signed out, or the call failed — an empty tab, not a broken page.
        if (!controller.signal.aborted) setVideos([]);
      });
    return () => controller.abort();
  }, [userId]);

  /* Opening the tab lands on the card being watched rather than the top of
     the catalogue — same target as the "Now playing" button below. */
  useEffect(() => {
    playingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [videos, currentVideoId]);

  /**
   * Which way the playing card lies once it has scrolled out of the list, or
   * null while it is still on screen. Both the card and the viewport are inside
   * this panel, so the observer is rooted on the scroller rather than the page.
   */
  const [awayFrom, setAwayFrom] = useState<"above" | "below" | null>(null);

  useEffect(() => {
    const root = scrollRef.current;
    const card = playingRef.current;
    if (!root || !card) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setAwayFrom(null);
          return;
        }
        // `boundingClientRect` is the card's, `rootBounds` the scroller's:
        // above the viewport means the card's bottom is over its top edge.
        const rootTop = entry.rootBounds?.top ?? 0;
        setAwayFrom(entry.boundingClientRect.bottom <= rootTop ? "above" : "below");
      },
      { root, threshold: 0 },
    );
    observer.observe(card);
    return () => observer.disconnect();
  }, [videos, currentVideoId]);

  if (videos === null) {
    return (
      <div className="grid grid-cols-2 gap-2 px-4 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="aspect-[210/314] animate-pulse rounded-[8px] bg-[var(--tt-field)]"
          />
        ))}
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-[14px] text-[var(--tt-text-secondary)]">
        No videos yet.
      </p>
    );
  }

  return (
    <div className="relative h-full">
      {/* `no-scrollbar` rather than a styled one: the side panel is a narrow
          column and the live site shows no track there either. */}
      <div ref={scrollRef} className="no-scrollbar h-full overflow-y-auto">
        <div className="grid grid-cols-2 gap-2 px-4 py-4">
          {videos.map((entry) => {
            const playing = entry.id === currentVideoId;
            return (
              <CreatorCard
                key={entry.id}
                ref={playing ? playingRef : undefined}
                video={entry}
                playing={playing}
                onClick={() => onSelect(entry.id)}
              />
            );
          })}
        </div>
      </div>

      {/* Scrolled past the video being watched — one tap back to it. The arrow
          points the way it went, so the button says where as well as what. */}
      {awayFrom && (
        <button
          type="button"
          onClick={() =>
            playingRef.current?.scrollIntoView({ behavior: "smooth", block: "center" })
          }
          className="absolute bottom-4 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full bg-[var(--tt-red)] px-3 py-2 text-[13px] font-semibold text-white shadow-[0_2px_12px_rgba(0,0,0,0.4)] transition-colors hover:bg-[var(--tt-red-hover)]"
        >
          <ArrowPostIcon
            className={cn("h-4 w-4", awayFrom === "below" && "rotate-180")}
          />
          Now playing
        </button>
      )}
    </div>
  );
}

const CreatorCard = forwardRef<
  HTMLButtonElement,
  { video: VideoResponse; playing: boolean; onClick: () => void }
>(function CreatorCard({ video, playing, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={playing ? undefined : onClick}
      aria-current={playing || undefined}
      className={cn(
        "relative block aspect-[210/314] w-full overflow-hidden rounded-[8px] bg-[var(--tt-field)]",
        playing ? "cursor-default" : "cursor-pointer",
      )}
    >
      {/* video-service returns no thumbnail for most videos, so with no poster
          the browser paints the first frame instead — the same fallback the
          profile grid's tiles rely on, hence `preload="metadata"` there. */}
      <video
        src={video.hlsUrl ?? undefined}
        poster={video.thumbnailUrl ?? undefined}
        muted
        playsInline
        preload={video.thumbnailUrl ? "none" : "metadata"}
        className="h-full w-full object-cover"
      />

      {playing ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
    {/* Fog / blur layer */}
            <span className="absolute inset-0 bg-black/35 backdrop-blur-md" />

            {/* Foreground content */}
            <span className="relative z-10 flex flex-col items-center gap-2 text-[13px] font-semibold text-white">
              <EqualizerGlyph />
              <span className="drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                Now playing
              </span>
            </span>
          </span>
      ) : (
        <span className="absolute inset-x-0 bottom-0 flex h-10 items-end gap-1 bg-[linear-gradient(transparent,rgba(0,0,0,0.6))] px-2 pb-2 text-[13px] font-semibold text-white">
          <PlayIcon className="h-3.5 w-3.5" />
          {formatCount(video.viewCount)}
        </span>
      )}
    </button>
  );
});

/** Three bars, as the live "Now playing" mask shows above its label. */
function EqualizerGlyph() {
  return (
      <svg
          viewBox="0 0 24 24"
          className="h-8 w-8"
          fill="currentColor"
      >
        <rect
            x="1"
            y="9"
            width="3"
            height="6"
            rx="1.5"
            className="animate-equalizer-1"
        />

        <rect
            x="6"
            y="6"
            width="3"
            height="12"
            rx="1.5"
            className="animate-equalizer-2"
        />

        <rect
            x="11"
            y="4"
            width="3"
            height="16"
            rx="1.5"
            className="animate-equalizer-3"
        />

        <rect
            x="16"
            y="7"
            width="3"
            height="10"
            rx="1.5"
            className="animate-equalizer-4"
        />

        <rect
            x="21"
            y="9"
            width="3"
            height="6"
            rx="1.5"
            className="animate-equalizer-5"
        />
      </svg>
  );
}
