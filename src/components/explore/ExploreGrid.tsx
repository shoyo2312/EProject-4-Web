"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { HeartIcon, MutedIcon, VolumeIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { useExploreFeed } from "@/hooks/use-explore-feed";
import { formatCount } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import { cn } from "@/lib/utils";
import type { ExploreItem } from "@/types/tiktok";

/**
 * `.DivShareLayoutV2` — the Explore page body: a horizontally scrollable
 * category bar over a video grid.
 *
 * Measured on the live page at 1920px:
 *   category bar  flex, 42px tall, 8px gap, 24px block padding, chevrons at
 *                 both ends that scroll the list
 *   grid          6 columns, 16px column gap / 24px row gap
 *   tile          254.656 × 371.859 — a 3:4 poster plus the author row beneath
 */
export function ExploreGrid({
  categories,
}: {
  categories: readonly string[];
}) {
  const [active, setActive] = useState(categories[0] ?? "All");
  const listRef = useRef<HTMLDivElement>(null);
  const { items: visible, isLoading, error } = useExploreFeed(active);
  // Sound is a page-level setting, not a per-tile one: exactly one tile plays at
  // a time — whichever is hovered, falling back to the last one hovered while
  // the sound was on — and it is audible whenever `soundOn`.
  const [soundOn, setSoundOn] = useState(false);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const playingId = hoveredId ?? pinnedId;

  const scrollBy = (direction: 1 | -1) => {
    listRef.current?.scrollBy({ left: 240 * direction, behavior: "smooth" });
  };

  const toggleSound = (id: string) => {
    const next = !soundOn;
    setSoundOn(next);
    setPinnedId(next ? id : null);
  };

  const setHover = (id: string, hovering: boolean) => {
    setHoveredId((current) => (hovering ? id : current === id ? null : current));
    // With the sound on, the pointer moving on carries it: the tile just
    // hovered is the one that keeps playing once the pointer leaves the grid.
    if (hovering && soundOn) setPinnedId(id);
  };

  return (
    <main className="h-screen flex-1 overflow-y-auto px-6 pb-12 tt-1024:px-4">
      {/* `.DivCategoryListWrapper` — sticky so the taxonomy stays reachable
          while the grid scrolls, which is how the live bar behaves. */}
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--tt-page)] pt-16 pb-6">
        <ChevronButton label="Scroll categories left" onClick={() => scrollBy(-1)} />

        <div
          ref={listRef}
          className="no-scrollbar flex flex-1 gap-2 overflow-x-auto scroll-smooth"
        >
          {categories.map((category) => (
            <button
              key={category}
              type="button"
              onClick={() => {
                setActive(category);
                setSoundOn(false);
                setPinnedId(null);
                setHoveredId(null);
              }}
              aria-pressed={category === active}
              className={cn(
                "h-[42px] flex-none rounded-[8px] px-4 text-[15px] font-medium whitespace-nowrap transition-colors",
                category === active
                  ? "bg-[var(--tt-text)] text-[var(--tt-page)]"
                  : "bg-[var(--tt-field)] text-[var(--tt-text)] hover:bg-[var(--tt-shape-neutral-3)]",
              )}
            >
              {category}
            </button>
          ))}
        </div>

        <ChevronButton
          label="Scroll categories right"
          onClick={() => scrollBy(1)}
          right
        />
      </div>

      {Boolean(error) && (
        <p className="pb-6 text-center text-[13px] text-[var(--tt-red-active)]">
          Can’t reach the API gateway on :8080.
        </p>
      )}

      {/* `.DivThreeColumnContainer` — 6 columns at full width, stepping down
          with the viewport. */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {isLoading
          ? Array.from({ length: 12 }).map((_, i) => <ExploreTileSkeleton key={i} />)
          : visible.map((item) => (
              <ExploreTile
                key={item.id}
                item={item}
                soundOn={soundOn}
                playing={playingId === item.id}
                onHoverChange={(hovering) => setHover(item.id, hovering)}
                onToggleSound={() => toggleSound(item.id)}
              />
            ))}
      </div>

      {!isLoading && visible.length === 0 && (
        <p className="py-24 text-center text-[15px] text-[var(--tt-text-muted)]">
          No videos in {active} yet.
        </p>
      )}
    </main>
  );
}

function ExploreTileSkeleton() {
  return (
    <div className="flex flex-col gap-2">
      <Skeleton className="aspect-[3/4] w-full rounded-[8px]" />
      <div className="flex items-center gap-2">
        <Skeleton className="h-6 w-6 flex-none rounded-full" />
        <Skeleton className="h-[18px] w-24" />
      </div>
    </div>
  );
}

/**
 * `.DivItemContainerV2` — a 3:4 poster that previews on hover, with a sound
 * toggle and the like count overlaid, and the author row underneath.
 *
 * Whether it plays is the grid's call — only one tile does at a time — so
 * `playing` comes down as a prop rather than being derived from `hovered`.
 */
function ExploreTile({
  item,
  soundOn,
  playing,
  onHoverChange,
  onToggleSound,
}: {
  item: ExploreItem;
  soundOn: boolean;
  playing: boolean;
  onHoverChange: (hovering: boolean) => void;
  onToggleSound: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !soundOn;
    if (playing) {
      // Autoplay can reject (e.g. reduced-power mode) — the poster stays up.
      void video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  }, [playing, soundOn]);

  return (
    <div className="flex flex-col gap-2">
      <Link
        href={`/video/${item.id}`}
        className="relative block aspect-[3/4] overflow-hidden rounded-[8px] bg-[var(--tt-field)]"
        onClick={() => markOverlayOrigin("/explore")}
        onMouseEnter={() => {
          setHovered(true);
          onHoverChange(true);
        }}
        onMouseLeave={() => {
          setHovered(false);
          onHoverChange(false);
        }}
      >
        <video
          ref={videoRef}
          src={item.videoUrl}
          poster={item.posterUrl}
          muted
          loop
          playsInline
          preload="none"
          className="h-full w-full object-cover"
        />

        {/* Like count and sound toggle sit on a bottom gradient so they stay
            legible on any poster frame. */}
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent px-2 pt-6 pb-2 text-[14px] font-medium text-white">
          <span className="pointer-events-none flex items-center gap-1">
            <HeartIcon className="h-4 w-4" />
            {formatCount(item.likes)}
          </span>

          <button
            type="button"
            aria-label={soundOn ? "Turn sound off" : "Turn sound on"}
            aria-pressed={soundOn}
            onClick={(event) => {
              // The toggle lives inside the tile's permalink.
              event.preventDefault();
              event.stopPropagation();
              onToggleSound();
            }}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full bg-black/40 transition-opacity hover:bg-black/60",
              hovered || playing
                ? "opacity-100"
                : "pointer-events-none opacity-0",
            )}
          >
            {soundOn ? (
              <VolumeIcon className="h-4 w-4" />
            ) : (
              <MutedIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </Link>

      <Link
        href={`/@${item.author.username}`}
        className="flex items-center gap-2 text-[14px] text-[var(--tt-text-secondary)] hover:underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- local static asset, no optimisation needed */}
        <img
          src={item.author.avatarUrl}
          alt=""
          className="h-6 w-6 flex-none rounded-full"
        />
        <span className="truncate">{item.author.nickname}</span>
      </Link>
    </div>
  );
}

function ChevronButton({
  label,
  onClick,
  right,
}: {
  label: string;
  onClick: () => void;
  right?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)] tt-768:hidden"
    >
      <svg
        viewBox="0 0 48 48"
        fill="currentColor"
        // The shared arrow path points up: +90° faces it right, −90° left.
        className={cn("h-5 w-5", right ? "rotate-90" : "-rotate-90")}
      >
        <path d="M24 15.4 8.7 30.7a1 1 0 0 0 0 1.4l1.4 1.4a1 1 0 0 0 1.4 0L24 20.9l12.5 12.6a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4L24 15.4Z" />
      </svg>
    </button>
  );
}
