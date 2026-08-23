"use client";

import { useCallback, useEffect, useRef } from "react";

import { recordView, recordWatch } from "@/lib/api/interactions";

interface UseWatchSessionOptions {
  videoId: string;
  /** From `useVideoPlayback` — the card that owns the viewport. */
  isActive: boolean;
  isPlaying: boolean;
  /** The clip's length as the player measured it, in seconds. */
  duration: number;
  /** False for a signed-out viewer: the endpoint has no identity to record. */
  enabled: boolean;
}

/**
 * Measures how long a card was actually watched and reports it **once**, when
 * the session ends — the card scrolls away, the feed unmounts, the tab goes.
 *
 * This is the label the ranking model trains on: one row per viewing session.
 * A per-second progress ping would fill the topic with rows describing the same
 * session and teach it nothing, which is why the backend takes a total rather
 * than a stream.
 *
 * Time is counted in wall-clock while playing, not from `currentTime`, so a
 * replay adds to the total instead of rewinding it — a viewer who loops a clip
 * three times watched it three times, and that is the signal worth having.
 */
export function useWatchSession({
  videoId,
  isActive,
  isPlaying,
  duration,
  enabled,
}: UseWatchSessionOptions): void {
  /** Accumulated ms, plus when the current playing stretch began (0 = paused). */
  const watchedMs = useRef(0);
  const startedAt = useRef(0);
  const sent = useRef(false);
  const viewed = useRef(false);

  /**
   * What the flush needs to know, kept in a ref so it can stay a stable callback
   * and its listeners do not re-subscribe on every playback tick. Declared above
   * the effects that flush, so this commit's values are in place before any of
   * them can fire.
   */
  const latest = useRef({ videoId, duration, enabled });
  useEffect(() => {
    latest.current = { videoId, duration, enabled };
  }, [videoId, duration, enabled]);

  /**
   * The view counter, which nothing else was moving — the watch report above is
   * the ranker's label and never touches it, so every video sat at 0 views.
   *
   * Sent when playback actually starts rather than when the card mounts, so
   * scrolling past a card at speed does not count as watching it. One `playId`
   * per session, generated here — the backend deduplicates by `playId`, so a
   * retry of this same call is harmless but a genuine replay (leaving the card
   * and scrolling back) needs a fresh one, which the reset below provides.
   */
  const playId = useRef<string | null>(null);
  useEffect(() => {
    if (!isPlaying || viewed.current || !latest.current.enabled) return;
    viewed.current = true;
    playId.current ??= crypto.randomUUID();
    void recordView(latest.current.videoId, playId.current).catch(() => undefined);
  }, [isPlaying]);

  useEffect(() => {
    if (!isPlaying) {
      if (startedAt.current !== 0) {
        watchedMs.current += performance.now() - startedAt.current;
        startedAt.current = 0;
      }
      return;
    }

    startedAt.current = performance.now();
    return () => {
      if (startedAt.current === 0) return;
      watchedMs.current += performance.now() - startedAt.current;
      startedAt.current = 0;
    };
  }, [isPlaying]);

  /**
   * Ends the session. Guarded by `sent` because the three triggers overlap —
   * scrolling away from the last card also unmounts it — and the backend counts
   * every call as its own session, so a double fire is a fabricated view.
   */
  const flush = useCallback(() => {
    const { videoId: id, duration: seconds, enabled: on } = latest.current;
    if (sent.current || !on) return;

    if (startedAt.current !== 0) {
      watchedMs.current += performance.now() - startedAt.current;
      startedAt.current = 0;
    }

    // A card that never played has nothing to say, and the server rejects a
    // non-positive duration outright — which is every video still transcoding,
    // since those have no length yet.
    if (watchedMs.current < 1 || !(seconds > 0)) return;

    sent.current = true;
    // Deliberately not awaited and errors dropped: this is telemetry leaving on
    // the way out, and there is no one left to tell. It is also why a tab closed
    // mid-request loses the row — `sendBeacon` cannot carry the bearer header,
    // so the trade is a lost sample against sending the token in a query string.
    void recordWatch(id, watchedMs.current, seconds * 1000).catch(() => undefined);
  }, []);

  // Scrolled away from: the card is no longer the one on screen. Resets rather
  // than only flushing, so scrolling back starts a genuinely new session.
  const wasActive = useRef(isActive);
  useEffect(() => {
    if (wasActive.current && !isActive) {
      flush();
      watchedMs.current = 0;
      sent.current = false;
      viewed.current = false;
      playId.current = null;
    }
    wasActive.current = isActive;
  }, [isActive, flush]);

  useEffect(() => {
    // `pagehide`, not `beforeunload`: it is the one that fires on mobile Safari
    // when the tab is backgrounded away, which is where most sessions end.
    window.addEventListener("pagehide", flush);
    return () => {
      window.removeEventListener("pagehide", flush);
      flush();
    };
  }, [flush]);
}
