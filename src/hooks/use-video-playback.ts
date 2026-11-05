"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";

import { usePlaybackHeld } from "@/hooks/use-playback-held";

interface UseVideoPlaybackOptions {
  /** Timeline length until the `<video>`'s own `duration` loads. */
  durationSeconds: number;
  /** Feed-wide mute preference — TikTok mutes the whole feed, not one card. */
  muted: boolean;
  /** Feed-wide volume, 0–1. Same reasoning as `muted`. */
  volume: number;
  /** False when `videoUrl` is empty — still transcoding — and the card renders a poster only. */
  hasSource: boolean;
  /** Playback speed, as the overflow menu's "Speed" section sets it. */
  playbackRate?: number;
  /**
   * Called when the browser refuses to autoplay with sound. Browsers only allow
   * unmuted autoplay after the user has interacted with the page, so a stored
   * "unmuted" preference cannot be honoured on a cold load — the caller is told
   * so it can put the app back into the muted state the player actually is in.
   */
  onAutoplayBlocked?: () => void;
}

export interface VideoPlayback {
  /** Attach to the element whose visibility decides which card is active. */
  containerRef: RefObject<HTMLElement | null>;
  /** Attach to the `<video>`; stays null in poster-only mode. */
  videoRef: RefObject<HTMLVideoElement | null>;
  isActive: boolean;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  togglePlay: () => void;
  seekToFraction: (fraction: number) => void;
}

/**
 * Scroll-driven playback, matching the feed's behaviour: the card that owns the
 * viewport plays, every other card is paused and rewound to 0. Tab-hidden
 * pauses; returning resumes the active card. A poster-only card has no clock:
 * it stays at 0 until its file exists.
 */
export function useVideoPlayback({
  durationSeconds,
  muted,
  volume,
  hasSource,
  playbackRate = 1,
  onAutoplayBlocked,
}: UseVideoPlaybackOptions): VideoPlayback {
  const containerRef = useRef<HTMLElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [isActive, setIsActive] = useState(false);
  const [wantsToPlay, setIsPlaying] = useState(false);
  // The daily limit's cover holds every player; the card resumes when it lifts.
  const held = usePlaybackHeld();
  const isPlaying = wantsToPlay && !held;
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSeconds);

  // Read inside listeners that must not re-subscribe on every activity change.
  const isActiveRef = useRef(false);

  // Which card owns the viewport. `scroll-snap-stop: always` means exactly one
  // card can clear this threshold at rest. Entering plays from the top; leaving
  // pauses and rewinds.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        // A fast scroll can batch an enter and a leave; the last one is current.
        const active = entries[entries.length - 1].isIntersecting;
        isActiveRef.current = active;
        setIsActive(active);
        setIsPlaying(active);
        setCurrentTime(0);
        const video = videoRef.current;
        if (video) video.currentTime = 0;
      },
      { threshold: 0.6 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Kept in a ref so a fresh callback identity cannot restart playback.
  const onAutoplayBlockedRef = useRef(onAutoplayBlocked);
  useEffect(() => {
    onAutoplayBlockedRef.current = onAutoplayBlocked;
  }, [onAutoplayBlocked]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (!isPlaying) {
      video.pause();
      return;
    }

    void video.play().catch((error: unknown) => {
      // A pause() or a source swap cut this call short — the newer state already
      // decided. Treating it as the autoplay policy would mute the whole feed and
      // restart a card the reader scrolled past or just paused.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // Otherwise a rejection with sound on is almost always the autoplay policy,
      // and the fix it wants is the same one the browser would have accepted:
      // mute and try once more, rather than leaving a frozen first frame.
      if (video.muted || !isActiveRef.current) {
        setIsPlaying(false);
        return;
      }
      video.muted = true;
      onAutoplayBlockedRef.current?.();
      void video.play().catch(() => setIsPlaying(false));
    });
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = muted;
    video.volume = volume;
  }, [muted, volume]);

  // Re-applied on every source swap too: `playbackRate` resets to 1 whenever the
  // element loads new media.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    video.playbackRate = playbackRate;
  }, [playbackRate, hasSource]);

  useEffect(() => {
    const onVisibilityChange = () => {
      setIsPlaying(document.visibilityState === "visible" && isActiveRef.current);
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!hasSource || !video) return;
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () =>
      setDuration(Number.isFinite(video.duration) ? video.duration : durationSeconds);
    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("loadedmetadata", onLoadedMetadata);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("loadedmetadata", onLoadedMetadata);
    };
  }, [hasSource, durationSeconds]);

  const togglePlay = useCallback(() => setIsPlaying((playing) => !playing), []);

  const seekToFraction = useCallback(
    (fraction: number) => {
      const clamped = Math.min(1, Math.max(0, fraction));
      const video = videoRef.current;
      const total = video && Number.isFinite(video.duration) ? video.duration : durationSeconds;
      const time = clamped * total;
      if (video) video.currentTime = time;
      setCurrentTime(time);
    },
    [durationSeconds],
  );

  return {
    containerRef,
    videoRef,
    isActive,
    isPlaying,
    currentTime,
    duration,
    togglePlay,
    seekToFraction,
  };
}
