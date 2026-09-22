"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { cn } from "@/lib/utils";

/**
 * The timeline, below the media and as wide as the column allows — 16px in
 * from each edge, a 2px track that thickens to 4px while pointed at, and a red
 * elapsed portion. The scrub head is deliberately invisible during playback
 * (the live bar shows none) and only appears while the bar itself is hovered
 * or dragged, which is what makes it grabbable at all.
 */
export function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek?: (fraction: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      onSeek?.((clientX - rect.left) / rect.width);
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

  const fraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        setDragging(true);
        seekFromClientX(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek?.(fraction + 0.02);
        if (event.key === "ArrowLeft") onSeek?.(fraction - 0.02);
      }}
      className="group/seek relative mx-4 flex h-5 flex-none cursor-pointer items-center"
    >
      <div
        ref={trackRef}
        className={cn(
          "w-full rounded-full bg-[var(--tt-progress-track)] transition-[height] duration-150 ease-in-out",
          dragging ? "h-1" : "h-0.5 group-hover/seek:h-1",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-0 rounded-full bg-[var(--tt-progress-elapsed)] transition-[height] duration-150 ease-in-out",
          dragging ? "h-1" : "h-0.5 group-hover/seek:h-1",
        )}
        style={{ width: `${fraction * 100}%` }}
      />
      <span
        className={cn(
          "pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white transition-opacity duration-150",
          dragging ? "opacity-100" : "opacity-0 group-hover/seek:opacity-100",
        )}
        style={{ left: `${fraction * 100}%` }}
      />
    </div>
  );
}
