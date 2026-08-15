"use client";

import { useEffect, type RefObject } from "react";

/**
 * Attaches an HLS manifest to a `<video>`.
 *
 * media-worker transcodes uploads to HLS, so a published video's `hlsUrl` is an
 * `.m3u8` playlist — which only Safari can hand to `<video src>` directly.
 * Everywhere else it needs Media Source Extensions, so hls.js is loaded (lazily,
 * and only for manifests) and attached instead.
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

    // Safari (and iOS in general) plays HLS natively; loading hls.js there
    // would replace a hardware-accelerated path with a JS one.
    if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = src;
      return;
    }

    let cancelled = false;
    let instance: { destroy: () => void } | null = null;

    import("hls.js").then(({ default: Hls }) => {
      if (cancelled || !Hls.isSupported()) return;

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
