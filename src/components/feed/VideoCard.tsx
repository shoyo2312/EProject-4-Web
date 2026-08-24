"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  VideoContextMenu,
  type MenuAnchor,
} from "@/components/feed/VideoContextMenu";
import { MutedIcon, VolumeIcon } from "@/components/icons";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useHlsSource, isHlsManifest } from "@/hooks/use-hls-source";
import { useVideoPlayback } from "@/hooks/use-video-playback";
import { useWatchSession } from "@/hooks/use-watch-session";
import { cn } from "@/lib/utils";
import { formatDuration } from "@/lib/format";
import type { FeedVideo } from "@/types/tiktok";

interface VideoCardProps {
  video: FeedVideo;
  /**
   * Double-tap only ever likes — it never un-likes. The state itself lives in
   * `Feed` so the action rail's heart reflects it.
   */
  onLike: () => void;
  /**
   * The author/caption overlay along the bottom of the player. On `/video/[id]`
   * the right column carries that text, so the overlay would repeat it.
   */
  showCaption?: boolean;
  /**
   * The in-player volume control. `/video/[id]` puts its own mute button in the
   * page's top-right cluster, so the overlay one would be a second toggle.
   */
  showVolumeControl?: boolean;
  /**
   * Right-click-to-open overflow menu. `/video/[id]` reaches the same settings
   * through the three-dot button in its own top-right cluster, and its menu
   * carries different trailing rows, so it opts out.
   */
  showContextMenu?: boolean;
  /**
   * Called when the clip reaches its end. Supplying it also turns `loop` off —
   * a looping element never fires `ended` — which is how "Auto scroll" on
   * `/video/[id]` gets a chance to step to the next video.
   */
  onEnded?: () => void;
}

/** How long to wait for a second click before treating one as a plain tap. */
const DOUBLE_TAP_MS = 250;

/** Matches the `tt-heart-pop` keyframe duration in globals.css. */
const HEART_LIFETIME_MS = 1000;

interface FloatingHeart {
  id: number;
  x: number;
  y: number;
  rotate: number;
}

/**
 * `section.SectionMediaCardContainer`. Contains, in z-order:
 *   media → click-to-pause layer → `.DivMediaCardOverlay` → progress bar.
 *
 * The overlay's top row holds the 48×48 volume control; the bottom section
 * (348×108 on the live site) holds author name, caption and "See translation".
 *
 * Playback is scroll-driven — see `useVideoPlayback`. An empty `videoUrl` falls
 * back to a still poster on the simulated clock; every current entry in
 * `FEED_VIDEOS` ships a real file.
 */
export function VideoCard({
  video,
  onLike,
  showCaption = true,
  showVolumeControl = true,
  showContextMenu = true,
  onEnded,
}: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const hasSource = video.videoUrl !== "";

  /*
   * Sound comes from context rather than props: it is one preference for the
   * whole app — every card, both routes, and across reloads — so threading it
   * through each parent would just be re-deriving the same value.
   */
  const { muted, volume, toggleMuted, changeVolume, mute, speed } = usePlayerSettings();

  const ratio = video.width / video.height;
  const isLandscape = ratio > 1;

  const {
    containerRef,
    videoRef,
    isActive,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seekToFraction,
  } = useVideoPlayback({
    durationSeconds: video.durationSeconds,
    muted,
    volume,
    hasSource,
    playbackRate: speed,
    onAutoplayBlocked: mute,
  });

  // Backend videos arrive as HLS playlists, which need hls.js everywhere but
  // Safari; the mock feed's .mp4 files keep using the plain `src` below.
  useHlsSource(videoRef, video.videoUrl);

  /*
   * How long this card was watched, reported once the viewer moves on. It is the
   * label the ranking model learns from, so it is gathered here — the only place
   * that knows when playback actually ran — rather than inferred from scrolling.
   *
   * Signed out it does nothing: the endpoint records per viewer and has no
   * identity to attach an anonymous session to. Poster-only cards are excluded
   * for the same reason the server rejects them: a video still transcoding has
   * no length, and a fraction of an unknown duration means nothing.
   */
  const { isSignedIn } = useSession();
  useWatchSession({
    videoId: video.id,
    isActive,
    isPlaying,
    duration,
    enabled: isSignedIn && hasSource,
  });

  const fraction = duration > 0 ? currentTime / duration : 0;

  /*
   * Tap vs double-tap. A double-click always fires two `click` events first, so
   * the play toggle is held for DOUBLE_TAP_MS and cancelled if a second click
   * lands inside the window. Without this, double-tapping to like would also
   * pause and immediately resume the video.
   */
  const [hearts, setHearts] = useState<FloatingHeart[]>([]);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heartTimers = useRef<Set<ReturnType<typeof setTimeout>>>(new Set());
  const nextHeartId = useRef(0);

  useEffect(() => {
    const timers = heartTimers.current;
    return () => {
      if (tapTimer.current) clearTimeout(tapTimer.current);
      timers.forEach(clearTimeout);
      timers.clear();
    };
  }, []);

  const spawnHeart = useCallback((clientX: number, clientY: number, host: HTMLElement) => {
    const rect = host.getBoundingClientRect();
    const id = nextHeartId.current++;
    setHearts((current) => [
      ...current,
      {
        id,
        x: clientX - rect.left,
        y: clientY - rect.top,
        // The live heart lands at a slight angle; the jitter range is a guess.
        rotate: Math.random() * 50 - 25,
      },
    ]);
    const timer = setTimeout(() => {
      setHearts((current) => current.filter((heart) => heart.id !== id));
      heartTimers.current.delete(timer);
    }, HEART_LIFETIME_MS);
    heartTimers.current.add(timer);
  }, []);

  const handleTap = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>) => {
      const { clientX, clientY, currentTarget } = event;

      if (tapTimer.current) {
        clearTimeout(tapTimer.current);
        tapTimer.current = null;
        onLike();
        spawnHeart(clientX, clientY, currentTarget);
        return;
      }

      tapTimer.current = setTimeout(() => {
        tapTimer.current = null;
        togglePlay();
      }, DOUBLE_TAP_MS);
    },
    [onLike, spawnHeart, togglePlay],
  );

  /**
   * Where the overflow menu was summoned, in this card's coordinates, or null
   * when it is closed. Stored relative to the card rather than to the viewport
   * because the menu renders inside the card, and the feed scrolls underneath.
   */
  const [menuAnchor, setMenuAnchor] = useState<MenuAnchor | null>(null);

  const openMenu = useCallback((event: React.MouseEvent<HTMLElement>) => {
    // Replaces the browser's own context menu, which is what the live site does
    // over the player.
    event.preventDefault();
    const box = event.currentTarget.getBoundingClientRect();
    setMenuAnchor({ x: event.clientX - box.left, y: event.clientY - box.top });
  }, []);

  const closeMenu = useCallback(() => setMenuAnchor(null), []);

  return (
    <section
      ref={containerRef}
      onContextMenu={showContextMenu ? openMenu : undefined}
      style={{ "--r": ratio } as React.CSSProperties}
      className={cn(
        "group/player relative self-center overflow-hidden rounded-[1rem] bg-[#111]",
        // Shared by both branches on the live site.
        "grow [aspect-ratio:var(--r)/1]",
        "min-w-[348px] [min-height:calc(348px/var(--r))]",
        isLandscape
          ? [
              // `max-width: min(availH * r, 60vw)` — the 60vw cap is the only
              // thing the landscape branch adds, and it is what actually binds
              // on a wide screen (measured live at 1920×936: 60vw = 1152px wins
              // over availH * 1.775 = 1604px, giving a 1152×649 card).
              "w-full",
              "[max-width:min(calc(var(--one-column-available-height)*var(--r)),60vw)]",
              "[max-height:min(var(--one-column-available-height),calc(60vw/var(--r)))]",
              // <=1280 drops the 60vw cap entirely, so the card goes back to
              // being purely height-bound.
              "tt-1280:[max-width:calc(var(--one-column-available-height)*var(--r))]",
              "tt-1280:[max-height:var(--one-column-available-height)]",
            ].join(" ")
          : [
              // Portrait is always height-bound: no viewport-width cap at all.
              "[height:var(--one-column-available-height)]",
              "[max-height:var(--one-column-available-height)]",
              "[max-width:calc(var(--one-column-available-height)*var(--r))]",
            ].join(" "),
      )}
    >
      {/* The card already carries the media's exact ratio, so `contain` and
          `cover` are visually identical here — they are mirrored only because
          the live site sets `contain` on landscape and `cover` on portrait. */}
      {hasSource ? (
        <video
          ref={videoRef}
          // Left unset for HLS: `useHlsSource` owns the element's source in
          // that case, and an `src` attribute would fight the MediaSource it
          // attaches.
          src={isHlsManifest(video.videoUrl) ? undefined : video.videoUrl}
          poster={video.posterUrl || undefined}
          loop={!onEnded}
          onEnded={onEnded}
          playsInline
          muted={muted}
          className={cn(
            "absolute inset-0 h-full w-full",
            isLandscape ? "object-contain" : "object-cover",
          )}
        />
      ) : video.posterUrl ? (
        <Image
          src={video.posterUrl}
          alt=""
          fill
          sizes="(max-width: 1280px) 60vw, 1152px"
          className={isLandscape ? "object-contain" : "object-cover"}
          priority
        />
      ) : (
        // Still transcoding and no thumbnail to stand in for it: black is
        // honest, a borrowed stock poster is not.
        <div className="absolute inset-0 bg-black" />
      )}

      {/* Tap = play/pause, double-tap = like. */}
      <button
        type="button"
        onClick={handleTap}
        aria-label={isPlaying ? "Pause" : "Play"}
        className="absolute inset-0 flex items-center justify-center"
      >
        {!isPlaying && <PlayGlyph />}
      </button>

      {/* Double-tap hearts. `transform-origin: 50% 100%` is the one value here
          taken from the live `.HeartWrapper`; the motion is a reconstruction. */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {hearts.map((heart) => (
          <span
            key={heart.id}
            className="absolute block h-24 w-24 -translate-x-1/2 -translate-y-full text-[var(--tt-red)] [animation:tt-heart-pop_1s_ease-out_forwards] [transform-origin:50%_100%]"
            style={{
              left: heart.x,
              top: heart.y,
              rotate: `${heart.rotate}deg`,
            }}
          >
            <svg viewBox="0 0 48 48" fill="currentColor" className="h-full w-full drop-shadow-[0_2px_8px_rgba(0,0,0,0.35)]">
              <path d="M24 42s-16-9.9-16-21.2A9.8 9.8 0 0 1 17.8 11c3.2 0 5.1 1.6 6.2 3.3 1.1-1.7 3-3.3 6.2-3.3A9.8 9.8 0 0 1 40 20.8C40 32.1 24 42 24 42Z" />
            </svg>
          </span>
        ))}
      </div>

      {/* Overlay — transparent to pointer events except its own controls. */}
      <div className="pointer-events-none absolute inset-0 flex flex-col justify-between">
        {/* Top row — volume control. The gradient behind it is invisible until
            the player is hovered: `--css-overlay-gradient-opacity` 0 → 0.3. */}
        <div className="relative flex items-center justify-between rounded-t-[1rem] px-2 pt-2">
          <div className="pointer-events-none absolute inset-0 rounded-t-[1rem] bg-[linear-gradient(to_top,rgba(18,18,18,0)_0%,rgba(0,0,0,0.3)_100%)] opacity-0 transition-opacity duration-150 ease-in-out group-hover/player:opacity-100" />
          {showVolumeControl && (
            <VolumeControl
              muted={muted}
              volume={volume}
              onToggleMuted={toggleMuted}
              onVolumeChange={changeVolume}
            />
          )}
        </div>

        {/* Bottom section — author, caption, translation. Expanding the caption
            swaps in the stronger of the site's two gradients. */}
        <div
          className={cn(
            "relative rounded-b-[1rem] px-4 pb-6 pt-8",
            !showCaption && "hidden",
          )}
        >
          <div
            className={cn(
              "pointer-events-none absolute inset-0 rounded-b-[1rem] transition-opacity duration-150",
              expanded
                ? "bg-[linear-gradient(transparent_0%,rgba(0,0,0,0.4)_30%,rgba(0,0,0,0.85)_100%)]"
                : "bg-[linear-gradient(transparent_0%,rgba(0,0,0,0.5)_100%)]",
            )}
          />
          <p className="relative text-[17px] font-medium leading-[22.1px] text-[var(--tt-icon)]">
            {video.author.nickname}
          </p>

          <p
            className={cn(
              "relative mt-1 text-[14px] leading-[21px] text-[var(--tt-text)]",
              !expanded && "line-clamp-1",
            )}
          >
            {video.caption}{" "}
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="pointer-events-auto font-bold text-[var(--tt-text)] hover:underline"
            >
              {expanded ? "less" : "more"}
            </button>
          </p>

          {video.hasTranslation && (
            <button
              type="button"
              className="pointer-events-auto relative mt-1 text-[14px] leading-[21px] text-[var(--tt-text-secondary)] hover:underline"
            >
              See translation
            </button>
          )}
        </div>
      </div>

      <ProgressBar
        fraction={fraction}
        currentTime={currentTime}
        duration={duration}
        onSeek={seekToFraction}
      />

      {menuAnchor && (
        <VideoContextMenu
          video={video}
          anchor={menuAnchor}
          hostRef={containerRef}
          onClose={closeMenu}
        />
      )}
    </section>
  );
}

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
function ProgressBar({
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

function PlayGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-16 w-16 text-white/70" fill="currentColor">
      <path d="M16 10.5c0-1.2 1.3-1.9 2.3-1.3l21 13.5a1.5 1.5 0 0 1 0 2.6l-21 13.5A1.5 1.5 0 0 1 16 37.5v-27Z" />
    </svg>
  );
}

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
function VolumeControl({
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

