"use client";

import { COMPOSER_EMOJI_GROUPS } from "@/lib/comments/emoji-groups";

/**
 * The grouped emoji grid, shared by the comment composer and the chat composer so there is one
 * list and one look. It only reports a pick: where the emoji lands (a caret, a selection) is the
 * composer's business.
 *
 * `onMouseDown` keeps the text box from losing focus when an emoji is pressed, so the caret and any
 * selection are still there when the pick is inserted.
 */
export function EmojiGroups({ onPick }: { onPick: (emoji: string) => void }) {
  return (
    <>
      {COMPOSER_EMOJI_GROUPS.map((group) => (
        <div key={group.label} className="mb-1 last:mb-0">
          <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tt-text-muted)]">
            {group.label}
          </p>
          <div className="grid grid-cols-8 gap-1">
            {group.emojis.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => onPick(emoji)}
                aria-label={emoji}
                className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[18px] leading-none transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60"
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
