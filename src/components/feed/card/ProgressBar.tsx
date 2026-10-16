"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { formatDuration } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * `.DivProgressBar` — geometry taken verbatim from the live site:
 *   container   height: max(0.25rem, 1rem)              → 16px hit area
 *   bounds      height: 0.25rem, :hover 0.375rem        → 4px → 6px
 *               background: --ui-image-overlay-white-a40
 *               align-self: end, transition height 150ms ease-in-out
 *   elapsed     transform: scaleX(n), transform-origin: left center
 *               background: --ui-shape-primary (#fe2c55 — red, not white)
 *   scrub head  0.75rem square, border-radius 50%, opacity 0, bottom 0,
 *               transform translateX(-50%) translateY(0.25rem),
 *               :hover translateY(0.125rem),
 *               box-shadow 0 0 1px 1px --ui-image-overlay-black-a15
 *   container   clip-path: inset(0 round 0 0 1rem 1rem)
 *
 * The head's opacity is driven by hovering the *player*, not the bar:
 * `DivVideoPlayerContainer:hover .es7xsve0 { opacity: 1 }`.
 */
export function ProgressBar({
  fraction,
  currentTime,
  duration,
  onSeek,
}: {
  fraction: number;
  currentTime: number;
  duration: number;
  onSeek: (fraction: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      onSeek((clientX - rect.left) / rect.width);
    },
    [onSeek],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => seekFromClientX(event.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, seekFromClientX]);

  const percent = `${fraction * 100}%`;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => {
        // Primary button only: the card's right-click opens the overflow menu,
        // and that must not also scrub the timeline under it.
        if (event.button !== 0) return;
        setDragging(true);
        seekFromClientX(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek(fraction + 0.02);
        if (event.key === "ArrowLeft") onSeek(fraction - 0.02);
      }}
      className="group/bar absolute inset-x-0 bottom-0 h-4 cursor-pointer"
    >
      <div className="absolute inset-0 flex [clip-path:inset(0_round_0_0_1rem_1rem)]">
        <div
          ref={trackRef}
          className={cn(
            "w-full self-end bg-[var(--tt-progress-track)] transition-[height] duration-150 ease-in-out",
            dragging ? "h-1.5" : "h-1 group-hover/bar:h-1.5",
          )}
        />
        <div
          className={cn(
            "absolute bottom-0 left-0 w-full origin-left bg-[var(--tt-progress-elapsed)] transition-[height] duration-150 ease-in-out",
            dragging ? "h-1.5" : "h-1 group-hover/bar:h-1.5",
          )}
          style={{ transform: `scaleX(${fraction})` }}
        />
      </div>

      <span
        className={cn(
          "absolute bottom-0 z-[1] h-3 w-3 -translate-x-1/2 cursor-grab rounded-full bg-white",
          "shadow-[0_0_1px_1px_var(--tt-scrub-shadow)]",
          "transition-[transform,opacity] duration-150 ease-in-out",
          dragging
            ? "translate-y-0.5 opacity-100"
            : "translate-y-1 opacity-0 group-hover/bar:translate-y-0.5 group-hover/player:opacity-100",
        )}
        style={{ left: percent }}
      />

      <p
        className={cn(
          "pointer-events-none absolute bottom-5 right-3 text-[12px] font-bold text-white/80 transition-opacity duration-150",
          dragging ? "opacity-100" : "opacity-0 group-hover/player:opacity-100",
        )}
      >
        {formatDuration(currentTime)} / {formatDuration(duration)}
      </p>
    </div>
  );
}
