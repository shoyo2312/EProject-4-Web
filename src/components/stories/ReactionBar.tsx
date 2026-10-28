"use client";

import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";

import type { StoryReaction } from "@/lib/api/types";
import { REACTIONS } from "@/lib/stories/reactions";
import { cn } from "@/lib/utils";

/** How long a floating copy of the emoji lives — matches `tt-reaction-float`. */
const FLOAT_MS = 900;

interface Float {
  id: number;
  emoji: string;
  /** Which button it rises from. */
  index: number;
  drift: number;
}

/**
 * The five reactions under someone else's story. Tapping one chooses it, tapping it again clears
 * it; a guest is sent to sign in instead. Each tap also sends a few copies of the emoji floating
 * up from the button. The bar swallows its pointer events so a tap never steps the story.
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
      const count = 4 + Math.floor(Math.random() * 3);
      // Built here, not in the updater: an updater may run twice and must stay pure.
      const burst: Float[] = Array.from({ length: count }, () => ({
        id: nextId.current++,
        emoji,
        index,
        drift: Math.round(Math.random() * 48 - 24),
      }));
      setFloats((current) => [...current, ...burst]);
    },
    [signedIn, onRequireLogin, onChange, value],
  );

  return (
    <div
      onPointerDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      className="relative flex gap-2 rounded-full bg-white/10 px-3 py-1.5 backdrop-blur-sm"
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
                style={{ "--drift": `${float.drift}px` } as CSSProperties}
                className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 text-[24px] motion-safe:animate-[tt-reaction-float_900ms_ease-out_forwards]"
              >
                {float.emoji}
              </span>
            ))}
        </span>
      ))}
    </div>
  );
}
