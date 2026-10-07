"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
 * The card's click layer: tap = play/pause, double-tap = like, plus the hearts
 * a double tap leaves behind.
 *
 * Tap vs double-tap. A double-click always fires two `click` events first, so
 * the play toggle is held for DOUBLE_TAP_MS and cancelled if a second click
 * lands inside the window. Without this, double-tapping to like would also
 * pause and immediately resume the video.
 */
export function TapLayer({
  isPlaying,
  onTogglePlay,
  onLike,
}: {
  isPlaying: boolean;
  onTogglePlay: () => void;
  /** Double-tap only ever likes — it never un-likes. */
  onLike: () => void;
}) {
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
        onTogglePlay();
      }, DOUBLE_TAP_MS);
    },
    [onLike, spawnHeart, onTogglePlay],
  );

  return (
    <>
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
    </>
  );
}

function PlayGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-16 w-16 text-white/70" fill="currentColor">
      <path d="M16 10.5c0-1.2 1.3-1.9 2.3-1.3l21 13.5a1.5 1.5 0 0 1 0 2.6l-21 13.5A1.5 1.5 0 0 1 16 37.5v-27Z" />
    </svg>
  );
}
