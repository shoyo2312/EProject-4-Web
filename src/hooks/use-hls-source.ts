"use client";

import { useEffect, useRef, type RefObject } from "react";

/** hls.js instance, kept behind the two calls this hook makes of it. */
type HlsInstance = {
  config: { maxBufferLength: number };
  loadSource: (src: string) => void;
  attachMedia: (video: HTMLVideoElement) => void;
  destroy: () => void;
};

/**
 * Seconds of media to hold. The card being watched buffers ahead normally; a
 * card that is only being prefetched takes just enough for playback to start
 * the instant the viewer scrolls onto it.
 */
const BUFFER_ACTIVE_SECONDS = 30;
const BUFFER_PREFETCH_SECONDS = 10;

/**
 * Attaches an HLS manifest to a `<video>`.
 *
 * media-worker transcodes uploads to HLS, so a published video's `hlsUrl` is an
 * `.m3u8` playlist, which most browsers cannot hand to `<video src>` directly.
 * hls.js is loaded lazily, and only for manifests, and feeds the element through
 * Media Source Extensions instead.
 *
 * Which path to take is decided by `Hls.isSupported()` — whether MSE exists —
 * and NOT by `canPlayType`. Chrome on macOS answers `"maybe"` for
 * `application/vnd.apple.mpegurl` while being entirely unable to play one, so
 * trusting it assigned the manifest straight to `video.src` and the element sat
 * at `networkState: 2` forever: no playback, no error, nothing in the console.
 * Native HLS is therefore used only where MSE is missing, which in practice
 * means iOS — the one place it is the only thing that works.
 *
 * Progressive files — the mock feed's local .mp4s — take neither path: the
 * element's own `src` attribute plays them, and this hook stays out of the way.
 *
 * `distance` is the card's offset from the one being watched, and decides
 * whether this video is fetched at all. Only `0` and `1` load: the video on
 * screen, and the one directly below it, which is prefetched so that scrolling
 * onto it starts playback with no request in the way. Everything else is left
 * alone — before this bound existed every mounted card opened its own hls.js
 * and they all pulled segments at once, which is the video being watched
 * competing for bandwidth with nineteen the viewer may never reach.
 */
export function useHlsSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
  distance = 0,
): void {
  const hlsRef = useRef<HlsInstance | null>(null);
  const inWindow = distance >= 0 && distance <= 1;

  useEffect(() => {
    if (!inWindow) return;

    const video = videoRef.current;
    if (!video || !src || !isHlsManifest(src)) return;

    let cancelled = false;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;

      if (!Hls.isSupported()) {
        // No Media Source Extensions — iOS, where HLS is native and this is the
        // only path that works at all. `preload` on the element is what limits
        // how much of a prefetched card it pulls.
        video.src = src;
        return;
      }

      const hls = new Hls({
        enableWorker: true,
        maxBufferLength: BUFFER_PREFETCH_SECONDS,
      }) as unknown as HlsInstance;
      hlsRef.current = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    });

    return () => {
      cancelled = true;
      hlsRef.current?.destroy();
      hlsRef.current = null;
    };
    // `distance` is deliberately not a dependency — only crossing the window
    // boundary may tear the instance down. Re-running when the card goes from
    // prefetched (1) to active (0) would destroy the very buffer that was
    // filled for this moment and re-request it, which is the whole point lost.
  }, [videoRef, src, inWindow]);

  // Grow the buffer once the card is the one being watched, and shrink it back
  // if the viewer scrolls the other way. Config is read per fragment, so this
  // takes effect without touching the instance.
  useEffect(() => {
    const hls = hlsRef.current;
    if (!hls) return;
    hls.config.maxBufferLength =
      distance === 0 ? BUFFER_ACTIVE_SECONDS : BUFFER_PREFETCH_SECONDS;
  }, [distance]);
}

export function isHlsManifest(src: string): boolean {
  return src.includes(".m3u8");
}
