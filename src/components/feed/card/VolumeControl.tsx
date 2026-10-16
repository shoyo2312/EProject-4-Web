"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { MutedIcon, VolumeIcon } from "@/components/icons";
import { cn } from "@/lib/utils";

/**
 * `.DivVolumeControlContainer` — collapsed it is just the 48px mute button; on
 * hover it grows sideways and a slider appears beside it.
 *
 * The two states are two emotion classes that differ in **exactly two
 * declarations**, which is what makes this cheap to reproduce:
 *
 *   collapsed  tiktok-8071rl   max-width: 3rem     background: transparent
 *   expanded   tiktok-5xj2l3   max-width: 12.5rem  background: neutral-4
 *
 * Everything else is shared: `display: flex; align-items: center; gap: .5rem;
 * padding: .5rem; padding-inline-end: 1rem; padding-inline-start: 0` (the last
 * only at `min-width: 767px`), `position: relative; border-radius: 24px;
 * min-width: 3rem; height: 3rem;` and
 * `transition-property: max-width, max-height; transition-duration: 300ms`.
 *
 * 200px checks out exactly: 0 (start) + 48 (button) + 8 (gap) + 128 (slider)
 * + 16 (end) = 200. Note the button therefore *overflows* the collapsed 48px
 * box by its 16px end padding; `overflow` is `visible` and the box is
 * transparent, so this is invisible — it is reproduced rather than corrected.
 *
 * Slider internals, measured with the control expanded:
 *   wrapper                128 × 32, position relative
 *   .VolumeSliderTrack     128 × 6,  radius 3px, rgba(255,255,255,.19)
 *   .VolumeSliderNotch       3 × 10, radius 2px, rgba(255,255,255,.32),
 *                          absolute at exactly 50% of the track
 *   .VolumeSliderKnob       20 × 24, radius 8px, rgb(250,250,250),
 *                          absolute, role="slider"
 *
 * There is **no filled/elapsed portion** — the track is one flat colour and
 * only the knob moves, unlike the red progress bar below the video.
 *
 * Reconstructed, not extracted: the live slider was never dragged (it would
 * change a real account's playback preference), so how value maps to mute is
 * this clone's own choice — dragging above 0 unmutes, dragging to 0 mutes.
 */
export function VolumeControl({
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

  // A muted card reads as zero on the slider regardless of the stored level, so
  // unmuting restores where the knob was rather than jumping to full.
  const shown = muted ? 0 : volume;
  const expanded = hovered || dragging;

  const setFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      const next = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
      onVolumeChange(next);
    },
    [onVolumeChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => setFromClientX(event.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, setFromClientX]);

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        "pointer-events-auto relative flex h-12 min-w-12 items-center gap-2",
        "rounded-[24px] py-2 pe-4 ps-0",
        "transition-[max-width,max-height] duration-300",
        expanded ? "max-w-[200px] bg-[var(--tt-field)]" : "max-w-12",
      )}
    >
      <button
        type="button"
        onClick={onToggleMuted}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-white/90"
      >
        {muted ? <MutedIcon className="h-6 w-6" /> : <VolumeIcon className="h-6 w-6" />}
      </button>

      {expanded && (
        <div
          ref={trackRef}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setDragging(true);
            setFromClientX(event.clientX);
          }}
          className="relative flex h-8 w-32 flex-none cursor-pointer items-center"
        >
          <div className="h-1.5 w-full rounded-[3px] bg-[rgba(255,255,255,0.19)]" />
          {/* Midpoint tick, measured at exactly 64px into the 128px track. */}
          <span className="pointer-events-none absolute left-1/2 h-2.5 w-[3px] rounded-[2px] bg-[rgba(255,255,255,0.32)]" />
          <span
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            onKeyDown={(event) => {
              if (event.key === "ArrowRight") onVolumeChange(Math.min(1, shown + 0.05));
              if (event.key === "ArrowLeft") onVolumeChange(Math.max(0, shown - 0.05));
            }}
            className="absolute h-6 w-5 rounded-[8px] bg-[rgb(250,250,250)]"
            style={{ left: `calc(${shown * 100}% - 10px)` }}
          />
        </div>
      )}
    </div>
  );
}
