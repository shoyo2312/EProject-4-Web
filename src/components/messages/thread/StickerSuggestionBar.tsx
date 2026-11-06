"use client";

import { CloseIcon } from "@/components/icons";
import type { StickerView } from "@/lib/api/conversations";

/** A strip of stickers over the message box while a feeling is being typed. Over it, not in the flow: it never moves the thread. */
export function StickerSuggestionBar({
  stickers,
  disabled,
  onPick,
  onDismiss,
}: {
  stickers: StickerView[];
  disabled: boolean;
  onPick: (sticker: StickerView) => void;
  onDismiss: () => void;
}) {
  return (
    <div
      role="group"
      aria-label="Suggested stickers"
      className="absolute bottom-full left-5 z-10 mb-2 flex max-w-[calc(100%-2.5rem)] items-center gap-1 rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-raised)] p-1.5 motion-safe:animate-chat-bar-in tt-768:left-3 tt-768:max-w-[calc(100%-1.5rem)]"
    >
      <div className="no-scrollbar flex min-w-0 gap-1 overflow-x-auto">
        {stickers.map((sticker) => (
          <button
            key={sticker.stickerId}
            type="button"
            disabled={disabled}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onPick(sticker)}
            aria-label={`Send sticker: ${sticker.name}`}
            title={sticker.name}
            className="flex h-14 w-14 flex-none items-center justify-center rounded-[var(--chat-radius-control)] p-1 transition-colors hover:bg-[var(--chat-active)] focus-visible:outline-2 focus-visible:outline-white/70 disabled:opacity-50"
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- a small public image from the sticker host; next/image would need that host allow-listed */}
            <img
              src={sticker.url}
              alt=""
              width={sticker.width}
              height={sticker.height}
              loading="lazy"
              decoding="async"
              referrerPolicy="no-referrer"
              className="h-full w-full object-contain"
            />
          </button>
        ))}
      </div>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onDismiss}
        aria-label="Hide sticker suggestions"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-white/70"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
