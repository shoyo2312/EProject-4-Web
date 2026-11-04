"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import type { StoryReaction } from "@/lib/api/types";
import { REACTIONS } from "@/lib/stories/reactions";
import { cn } from "@/lib/utils";

/** Copies per tap, inclusive. */
const MIN_PER_BURST = 3;
const MAX_PER_BURST = 5;
/** One copy's flight is 1.3–1.9 s, and the copies leave up to ~0.4 s apart. */
const FLOAT_MS = 2400;

interface Float {
  id: number;
  emoji: string;
  /** Which button it rises from. */
  index: number;
  /** Where it ends up sideways, how far it rocks on the way, and how high it goes, in px. */
  drift: number;
  sway: number;
  rise: number;
  durationMs: number;
  delayMs: number;
  size: number;
}

/**
 * The five reactions under someone else's story. Tapping one chooses it, tapping it again clears
 * it; a guest is sent to sign in instead. Each tap also sends 3–5 copies of the emoji floating up
 * over the story, rocking side to side as they go and fading out, one after another — none with
 * reduced motion. The bar swallows its pointer events so a tap never steps the story.
 */
export function ReactionBar({
  value,
  onChange,
  signedIn,
  onRequireLogin,
}: {
  value: StoryReaction | null;
  onChange: (next: StoryReaction | null) => void;
  signedIn: boolean;
  onRequireLogin: () => void;
}) {
  const [floats, setFloats] = useState<Float[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    if (floats.length === 0) return;
    const timer = window.setTimeout(() => setFloats([]), FLOAT_MS);
    return () => window.clearTimeout(timer);
  }, [floats]);

  const tap = useCallback(
    (index: number) => {
      if (!signedIn) {
        onRequireLogin();
        return;
      }
      const { type, emoji } = REACTIONS[index];
      onChange(value === type ? null : type);
      const count = MIN_PER_BURST + Math.floor(Math.random() * (MAX_PER_BURST - MIN_PER_BURST + 1));
      // Built here, not in the updater: an updater may run twice and must stay pure.
      const burst: Float[] = Array.from({ length: count }, (_, i) => ({
        id: nextId.current++,
        emoji,
        index,
        drift: Math.round(Math.random() * 60 - 30),
        sway: Math.round(6 + Math.random() * 10),
        rise: Math.round(240 + Math.random() * 80),
        durationMs: Math.round(1300 + Math.random() * 600),
        delayMs: i * 90 + Math.round(Math.random() * 60),
        size: Math.round(26 + Math.random() * 10),
      }));
      setFloats((current) => [...current, ...burst]);
    },
    [signedIn, onRequireLogin, onChange, value],
  );

  return (
    <div
      data-reaction-bar=""
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="pointer-events-auto relative flex gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm"
    >
      {REACTIONS.map(({ type, emoji, label }, index) => (
        <span key={type} className="relative">
          <button
            type="button"
            aria-label={label}
            aria-pressed={value === type}
            onClick={() => tap(index)}
            className={cn(
              "rounded-full text-[28px] leading-none duration-150 motion-safe:transition-transform hover:scale-110",
              value === type && "scale-125 ring-2 ring-white",
            )}
          >
            {emoji}
          </button>
          {floats
            .filter((float) => float.index === index)
            .map((float) => (
              <span
                key={float.id}
                aria-hidden
                data-float=""
                style={
                  {
                    "--drift": `${float.drift}px`,
                    "--sway": `${float.sway}px`,
                    "--rise": `${float.rise}px`,
                    fontSize: `${float.size}px`,
                    animationDuration: `${float.durationMs}ms`,
                    animationDelay: `${float.delayMs}ms`,
                  } as CSSProperties
                }
                className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 leading-none motion-safe:animate-[tt-reaction-float_1600ms_ease-out_both] motion-reduce:hidden"
              >
                {float.emoji}
              </span>
            ))}
        </span>
      ))}
    </div>
  );
}
