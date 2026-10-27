"use client";

import { useState } from "react";

import { EmojiGroups } from "@/components/ui/EmojiPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { useStickerPacks } from "@/hooks/use-sticker-packs";
import type { StickerView } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";

type Tab = "emoji" | "sticker";

const TABS: { id: Tab; label: string }[] = [
  { id: "emoji", label: "Emoji" },
  { id: "sticker", label: "Sticker" },
];

/**
 * The chat's picker, one panel with two tabs. Emoji are the comment composer's own grid, so a pick
 * only ever puts a character in the draft; a sticker is a message of its own, sent on the spot.
 *
 * It fits where it is put: the composer gives it the width of the thread, capped, and it scrolls
 * inside itself, so it cannot spill out of the floating panel or off a phone.
 */
export function ChatPicker({
  onEmoji,
  onSticker,
  stickerBusy,
}: {
  onEmoji: (emoji: string) => void;
  onSticker: (sticker: StickerView) => void;
  /** A sticker is on its way: the grid stops taking presses until it lands or fails. */
  stickerBusy: boolean;
}) {
  const [tab, setTab] = useState<Tab>("emoji");

  return (
    <div className="flex max-h-[min(320px,60vh)] w-full flex-col overflow-hidden rounded-[12px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] shadow-lg animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none">
      <div role="tablist" aria-label="Emoji and stickers" className="flex flex-none border-b border-[var(--tt-divider)] px-2 pt-1">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            id={`chat-picker-tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`chat-picker-panel-${id}`}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => setTab(id)}
            className={cn(
              "h-9 px-4 text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white/60",
              tab === id
                ? "border-b-2 border-[var(--tt-text)] text-[var(--tt-text)]"
                : "border-b-2 border-transparent text-[var(--tt-text-muted)] hover:text-[var(--tt-text)]",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`chat-picker-panel-${tab}`}
        aria-labelledby={`chat-picker-tab-${tab}`}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
      >
        {tab === "emoji" ? <EmojiGroups onPick={onEmoji} /> : <StickerGrid onPick={onSticker} busy={stickerBusy} />}
      </div>
    </div>
  );
}

function StickerGrid({ onPick, busy }: { onPick: (sticker: StickerView) => void; busy: boolean }) {
  const catalog = useStickerPacks(true);

  if (catalog.status === "loading") {
    return (
      <div aria-hidden className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-[10px]" />
        ))}
      </div>
    );
  }

  if (catalog.status === "error") {
    return (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <p className="text-[14px] font-semibold text-[var(--tt-text)]">Couldn&apos;t load stickers</p>
        <button
          type="button"
          onClick={catalog.reload}
          className="mt-3 h-9 rounded-full bg-[var(--tt-field)] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60"
        >
          Try again
        </button>
      </div>
    );
  }

  const stickers = catalog.packs.flatMap((pack) => pack.stickers);
  if (stickers.length === 0) {
    return <p className="px-4 py-8 text-center text-[14px] text-[var(--tt-text-muted)]">No stickers yet.</p>;
  }

  return (
    <div className="grid grid-cols-4 gap-2">
      {stickers.map((sticker) => (
        <button
          key={sticker.stickerId}
          type="button"
          disabled={busy}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(sticker)}
          aria-label={`Send sticker: ${sticker.name}`}
          title={sticker.name}
          className="flex aspect-square items-center justify-center rounded-[10px] p-1 transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60 disabled:opacity-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a fixed-size public image from the media store; next/image would need its host allow-listed */}
          <img src={sticker.url} alt="" width={sticker.width} height={sticker.height} loading="lazy" decoding="async" className="h-full w-full object-contain" />
        </button>
      ))}
    </div>
  );
}
