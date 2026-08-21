"use client";

import { useEffect, type RefObject } from "react";

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
 */
export function useHlsSource(
  videoRef: RefObject<HTMLVideoElement | null>,
  src: string,
): void {
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !src || !isHlsManifest(src)) return;

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled) return;

      if (!Hls.isSupported()) {
        // No Media Source Extensions — iOS, where HLS is native and this is the
        // only path that works at all.
        video.src = src;
        return;
      }

      const hls = new Hls({ enableWorker: true });
      instance = hls;
      hls.loadSource(src);
      hls.attachMedia(video);
    });

    return () => {
      cancelled = true;
      instance?.destroy();
    };
  }, [videoRef, src]);
}

export function isHlsManifest(src: string): boolean {
  return src.includes(".m3u8");
}
