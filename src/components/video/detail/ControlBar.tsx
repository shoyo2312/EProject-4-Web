"use client";

import { useCallback, useRef, useState } from "react";

import { PlayIcon } from "@/components/icons";
import { SpeedPills, Switch } from "@/components/player/PlayerMenu";
import { OwnerControls } from "@/components/video/detail/OwnerControls";
import { ReportControl } from "@/components/video/detail/ReportControl";
import { VerticalVolumeControl } from "@/components/video/detail/VerticalVolumeControl";
import { useDismiss } from "@/hooks/use-dismiss";
import { useFollow } from "@/hooks/use-follow";
import { isBackendHandle } from "@/lib/api/adapters";
import { formatDuration } from "@/lib/format";
import type { FeedVideo } from "@/types/tiktok";

/**
 * The 52px strip under the seek bar. Play/pause and the clock on the left, the
 * settings cluster on the right — auto scroll, speed, volume. The live bar
 * ends in a "…" and a captions toggle; neither is reproduced (there are no
 * caption tracks here, and the menu behind "…" has no home on this page).
 */
export function ControlBar({
  video,
  onDeleted,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  speed,
  onSpeedChange,
  autoScroll,
  onAutoScrollChange,
  muted,
  volume,
  onToggleMuted,
  onVolumeChange,
}: {
  video: FeedVideo;
  /** Called once the owner's own video is deleted — closes the overlay. */
  onDeleted: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay?: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoScroll: boolean;
  onAutoScrollChange: (on: boolean) => void;
  muted: boolean;
  volume: number;
  onToggleMuted: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  return (
    <div className="flex h-[30px] flex-none items-center justify-between px-2 mb-8">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
        >
          {isPlaying ? (
            <PauseGlyph className="h-7 w-7" />
          ) : (
            <PlayIcon className="h-7 w-7" />
          )}
        </button>
        <span className="text-[16px] font-light text-[var(--tt-text)]">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={autoScroll}
          onClick={() => onAutoScrollChange(!autoScroll)}
          className="flex h-9 items-center gap-2 rounded-[8px] px-2 text-[14px] font-semibold text-[var(--tt-text)]"
        >
          Auto scroll
          <Switch on={autoScroll} />
        </button>

        <SpeedControl speed={speed} onSpeedChange={onSpeedChange} />

        {/* Anchored to the bar's bottom edge so the slider grows up over the
            player instead of stretching the bar. */}
        <div className="relative h-9 w-9">
          <div className="absolute bottom-0 right-0">
            <VerticalVolumeControl
              muted={muted}
              volume={volume}
              onToggleMuted={onToggleMuted}
              onVolumeChange={onVolumeChange}
            />
          </div>
        </div>

        <VideoActionsControl video={video} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

/** The "1.0x" button and the speed group it opens above itself. */
function SpeedControl({
  speed,
  onSpeedChange,
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const close = useCallback(() => setOpen(false), []);
  useDismiss(rootRef, open, close);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Playback speed"
        className="flex h-8 items-center rounded-[8px] px-3 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
      >
        {speed.toFixed(1)}x
      </button>

      {open && (
        <div className="absolute bottom-11 right-0 rounded-full bg-[var(--tt-sheet-3,#252525)] p-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          <SpeedPills speed={speed} onSpeedChange={onSpeedChange} />
        </div>
      )}
    </div>
  );
}

/** No pause glyph in `icons.tsx` — two bars, matching `PlayIcon`'s 48 box. */
function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M13 8h7v32h-7V8Zm15 0h7v32h-7V8Z" />
    </svg>
  );
}

/**
 * The rightmost control in the player's bottom bar, beside volume. Which one it
 * is depends on who is watching: the owner gets their privacy/delete menu, and
 * everybody else gets Report. A mock video has no backend to call, so the owner
 * branch is skipped there and the viewer branch reports nothing.
 */
function VideoActionsControl({
  video,
  onDeleted,
}: {
  video: FeedVideo;
  onDeleted: () => void;
}) {
  const { isSelf } = useFollow(video.author.userId, video.isFollowing);

  if (!isBackendHandle(video.id)) return null;

  return isSelf ? (
    <OwnerControls
      videoId={video.id}
      initialVisibility={video.visibility}
      initialCommentsDisabled={video.commentsDisabled}
      onDeleted={onDeleted}
    />
  ) : (
    <ReportControl videoId={video.id} />
  );
}
