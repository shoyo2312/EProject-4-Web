"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import { RepostBadge } from "@/components/feed/RepostBadge";
import {
  VideoContextMenu,
  type MenuAnchor,
} from "@/components/feed/VideoContextMenu";
import { ProgressBar } from "@/components/feed/card/ProgressBar";
import { TapLayer } from "@/components/feed/card/TapLayer";
import { VolumeControl } from "@/components/feed/card/VolumeControl";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useClampOverflow } from "@/hooks/use-clamp-overflow";
import { useHlsSource, isHlsManifest } from "@/hooks/use-hls-source";
import { useVideoPlayback, type VideoPlayback } from "@/hooks/use-video-playback";
import { useWatchSession } from "@/hooks/use-watch-session";
import { isBackendVideoId } from "@/lib/api/adapters";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/types/tiktok";

interface VideoCardProps {
  video: FeedVideo;
  /**
   * Double-tap only ever likes — it never un-likes. The state itself lives in
   * the page's `useVideoLike` so the action rail's heart reflects it.
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
  /**
   * Fired when this card becomes the one owning the viewport — the same signal
   * that starts playback, so anything keyed to "the video being watched" cannot
   * disagree with what is actually playing. The feed uses it to keep the open
   * comment sidebar on the video the viewer scrolled to.
   */
  onActive?: () => void;
  /**
   * The in-card seek bar along the player's bottom edge. `/video/[id]` draws
   * its own, full-column-width one below the media (as the live site does), so
   * it turns this off rather than showing two timelines.
   */
  showProgressBar?: boolean;
  /**
   * Hands the card's playback state and controls to the parent, so a
   * play/pause button and a seek bar living *outside* the card can drive the
   * same element. Called on mount and whenever the clock moves.
   */
  onPlayback?: (playback: VideoPlayback) => void;
  /**
   * This card's offset from the one being watched — `0` for it, `1` for the
   * card directly below, negative for cards already scrolled past. Only the
   * first two fetch any media; see `useHlsSource`. Defaults to `0` for the
   * single-card pages, where the card on screen is the only one there is.
   */
  distance?: number;
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
  distance = 0,
  onLike,
  showCaption = true,
  showVolumeControl = true,
  showContextMenu = true,
  showProgressBar = true,
  onPlayback,
  onEnded,
  onActive,
}: VideoCardProps) {
  const [expanded, setExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const isDescriptionOverflowing = useClampOverflow(
    descriptionRef,
    video.description,
  );
  const hasSource = video.videoUrl !== "";

  /*
   * Sound comes from context rather than props: it is one preference for the
   * whole app — every card, both routes, and across reloads — so threading it
   * through each parent would just be re-deriving the same value.
   */
  const { muted, volume, toggleMuted, changeVolume, mute, speed } = usePlayerSettings();

  const ratio = video.width / video.height;
  const isLandscape = ratio > 1;

  const playback = useVideoPlayback({
    durationSeconds: video.durationSeconds,
    muted,
    volume,
    hasSource,
    playbackRate: speed,
    onAutoplayBlocked: mute,
  });
  const {
    containerRef,
    videoRef,
    isActive,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seekToFraction,
  } = playback;

  /*
   * Publish the playback surface to a parent that draws its own controls.
   * Deliberately keyed on the *values*, not on the object — `useVideoPlayback`
   * returns a fresh object every render, so depending on it would publish on
   * every render, and a parent that stores what it receives would re-render
   * this card and publish again, forever.
   */
  const playbackRef = useRef(playback);
  const onPlaybackRef = useRef(onPlayback);
  useEffect(() => {
    playbackRef.current = playback;
    onPlaybackRef.current = onPlayback;
  });
  useEffect(() => {
    onPlaybackRef.current?.(playbackRef.current);
  }, [isPlaying, currentTime, duration, togglePlay, seekToFraction]);

  // Held in a ref so a parent that re-creates the callback each render cannot
  // re-announce the same card as newly active.
  const onActiveRef = useRef(onActive);
  useEffect(() => {
    onActiveRef.current = onActive;
  }, [onActive]);

  useEffect(() => {
    if (isActive) onActiveRef.current?.();
  }, [isActive]);

  // Backend videos arrive as HLS playlists, which need hls.js everywhere but
  // Safari; the mock feed's .mp4 files keep using the plain `src` below.
  useHlsSource(videoRef, video.videoUrl, distance);

  /*
   * How long this card was watched, reported once the viewer moves on. It is the
   * label the ranking model learns from, so it is gathered here — the only place
   * that knows when playback actually ran — rather than inferred from scrolling.
   *
   * Signed out it does nothing: the endpoint records per viewer and has no
   * identity to attach an anonymous session to. Poster-only cards are excluded
   * for the same reason the server rejects them: a video still transcoding has
   * no length, and a fraction of an unknown duration means nothing. A mock
   * video has no row to record against at all.
   */
  const { isSignedIn } = useSession();
  useWatchSession({
    videoId: video.id,
    isActive,
    isPlaying,
    duration,
    enabled: isSignedIn && hasSource && isBackendVideoId(video.id),
  });

  const fraction = duration > 0 ? currentTime / duration : 0;

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
        // No width floor: the card is sized by the two caps below, and any
        // floor at all is a min-content the feed column cannot shrink past.
        // With the comment sidebar out at 1025-1083px the old 348px floor
        // pushed the page 49px wider than the viewport — a horizontal
        // scrollbar on the whole site — and just under it the action rail was
        // clipped instead. The column is the honest limit; let it bind.
        "min-w-0 [min-height:0]",
        isLandscape
          ? [
              // `max-width: min(availH * r, 60vw)` — the 60vw cap is the only
              // thing the landscape branch adds, and it is what actually binds
              // on a wide screen (measured live at 1920×936: 60vw = 1152px wins
              // over availH * 1.775 = 1604px, giving a 1152×649 card).
              "w-full",
              "[max-width:min(calc(var(--one-column-available-height)*var(--r)),60vw,100%)]",
              "[max-height:min(var(--one-column-available-height),calc(60vw/var(--r)))]",
              // <=1280 drops the 60vw cap entirely, so the card goes back to
              // being purely height-bound.
              "tt-1280:[max-width:min(calc(var(--one-column-available-height)*var(--r)),100%)]",
              "tt-1280:[max-height:var(--one-column-available-height)]",
            ].join(" ")
          : [
              // Portrait is height-bound through `max-height`, never through an
              // explicit height: with the comment sidebar out, the column can
              // be narrower than `availH * r`, and a fixed height would beat
              // the aspect ratio there — the media stretches sideways and the
              // card's own min-content keeps the row wider than the viewport.
              // Ratio + the two caps give the same card whenever height is
              // what binds, and shrink honestly when the column is.
              "[max-height:var(--one-column-available-height)]",
              "[max-width:min(calc(var(--one-column-available-height)*var(--r)),100%)]",
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
          // Same window as `useHlsSource`: the card on screen and the next one
          // fetch, the rest stay at their poster until they get close.
          preload={distance >= 0 && distance <= 1 ? "auto" : "none"}
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
      <TapLayer isPlaying={isPlaying} onTogglePlay={togglePlay} onLike={onLike} />

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
          {/* Above the owner line — RepostBadge renders nothing unless the viewer or
              someone they follow reposted this video. */}
          <div className="relative mb-2 flex justify-start">
            <RepostBadge videoId={video.id} className="pointer-events-auto" />
          </div>

          <p className="relative text-[17px] font-medium leading-[22.1px] text-[var(--tt-icon)]">
            {video.author.nickname}
          </p>

          {video.title && (
            <p className="relative mt-1 text-[15px] font-bold leading-[20px] text-[var(--tt-text)]">
              {video.title}
            </p>
          )}

          {video.description && (
            // 85% wide — the video duration sits in the bottom-right corner.
            <div className="relative mt-1 max-w-[85%]">
              <p
                ref={descriptionRef}
                className={cn(
                  "text-[14px] leading-[21px] text-[var(--tt-text)]",
                  !expanded && "line-clamp-2",
                )}
              >
                {video.description}
              </p>
              {(expanded || isDescriptionOverflowing) && (
                <button
                  type="button"
                  onClick={() => setExpanded((v) => !v)}
                  className="pointer-events-auto mt-0.5 text-[14px] font-bold leading-[21px] text-[var(--tt-text)] hover:underline"
                >
                  {expanded ? "less" : "more"}
                </button>
              )}
            </div>
          )}

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

      {showProgressBar && (
        <ProgressBar
          fraction={fraction}
          currentTime={currentTime}
          duration={duration}
          onSeek={seekToFraction}
        />
      )}

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
