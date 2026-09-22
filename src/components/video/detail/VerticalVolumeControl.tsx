"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MutedIcon, VolumeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * The feed's `VolumeControl`, turned on its side for this page: the button is
 * pinned to the player's bottom-right corner, so the slider has to grow upward
 * — a rightward one would run into the comment column.
 *
 * Same parts and sizes as the horizontal original (48px button, 128px track,
 * a midpoint notch, a knob with no filled portion behind it, 300ms grow), with
 * every axis swapped: the box expands in `max-height`, the track is 6px wide by
 * 128px tall, and the knob is measured from the track's bottom, so full volume
 * is at the top.
 */
export function VerticalVolumeControl({
  muted,
  volume,
  onToggleMuted,
  onVolumeChange,
}: {
  muted: boolean;
  volume: number;
  onToggleMuted: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const shown = muted ? 0 : volume;
  const expanded = hovered || dragging;

  const setFromClientY = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return;
      const next = Math.min(
        1,
        Math.max(0, (rect.bottom - clientY) / rect.height),
      );
      onVolumeChange(next);
    },
    [onVolumeChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => setFromClientY(event.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, setFromClientY]);

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        // Column-reverse so the button keeps its place at the bottom and the
        // slider appears above it.
        "relative flex w-9 min-h-9 flex-col-reverse items-center gap-2",
        "rounded-[18px] px-1.5 pb-0 pt-4",
        "transition-[max-height] duration-300",
        expanded ? "max-h-[190px] bg-[var(--tt-field)]" : "max-h-9",
      )}
    >
      <button
        type="button"
        onClick={onToggleMuted}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90"
      >
        {muted ? (
          <MutedIcon className="h-6 w-6" />
        ) : (
          <VolumeIcon className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <div
          ref={trackRef}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setDragging(true);
            setFromClientY(event.clientY);
          }}
          className="relative flex h-32 w-8 flex-none cursor-pointer justify-center"
        >
          <div className="h-full w-1.5 rounded-[3px] bg-[rgba(255,255,255,0.19)]" />
          <span className="pointer-events-none absolute top-1/2 h-[3px] w-2.5 rounded-[2px] bg-[rgba(255,255,255,0.32)]" />
          <span
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp")
                onVolumeChange(Math.min(1, shown + 0.05));
              if (event.key === "ArrowDown")
                onVolumeChange(Math.max(0, shown - 0.05));
            }}
            className="absolute h-5 w-6 rounded-[8px] bg-[rgb(250,250,250)]"
            style={{ bottom: `calc(${shown * 100}% - 10px)` }}
          />
        </div>
      )}
    </div>
  );
}
