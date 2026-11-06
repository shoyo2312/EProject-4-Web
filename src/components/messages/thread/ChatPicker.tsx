"use client";

import { Clock } from "lucide-react";
import { useState } from "react";

import { EmojiGroups } from "@/components/ui/EmojiPicker";
import { Skeleton } from "@/components/ui/skeleton";
import { useGiphyStickers } from "@/hooks/use-giphy-stickers";
import type { StickerView } from "@/lib/api/conversations";
import {
  STICKER_CATEGORIES,
  readRecentStickers,
  rememberSticker,
  type StickerCategoryId,
} from "@/lib/chat-stickers";
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
    <div className="flex max-h-[min(340px,60vh)] w-full flex-col overflow-hidden rounded-[var(--chat-radius-surface)] border border-[var(--chat-line)] bg-[var(--chat-pop)] shadow-[var(--chat-shadow-pop)] animate-in fade-in slide-in-from-bottom-1 duration-150 motion-reduce:animate-none">
      <div role="tablist" aria-label="Emoji and stickers" className="mx-3 mt-3 flex flex-none rounded-full bg-white/[0.06] p-1">
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
              "h-8 flex-1 rounded-full text-[13px] font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-white/70",
              tab === id
                ? "bg-white/[0.14] text-[var(--tt-text)]"
                : "text-[var(--chat-meta)] hover:text-[var(--tt-text)]",
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
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain p-3"
      >
        {tab === "emoji" ? <EmojiGroups onPick={onEmoji} /> : <StickerGrid onPick={onSticker} busy={stickerBusy} />}
      </div>
    </div>
  );
}

type Section = "recent" | StickerCategoryId;

function StickerGrid({ onPick, busy }: { onPick: (sticker: StickerView) => void; busy: boolean }) {
  const [recent, setRecent] = useState(readRecentStickers);
  const [section, setSection] = useState<Section>(() => (readRecentStickers().length > 0 ? "recent" : "trending"));
  const [typed, setTyped] = useState("");
  const searching = typed.trim().length > 0;
  const category = STICKER_CATEGORIES.find((c) => c.id === section);
  const showRecent = !searching && section === "recent";
  const giphy = useGiphyStickers(searching ? typed : (category?.query ?? ""), !showRecent, searching ? 350 : 0);

  const pick = (sticker: StickerView) => {
    setRecent(rememberSticker(sticker));
    onPick(sticker);
  };

  const heading = searching ? "Search results" : showRecent ? "Recent" : (category?.label ?? "");

  let body: React.ReactNode;
  if (showRecent) {
    body =
      recent.length === 0 ? (
        <p className="px-4 py-8 text-center text-[14px] text-[var(--tt-text-muted)]">Stickers you send will show up here.</p>
      ) : (
        <StickerButtons stickers={recent} onPick={pick} busy={busy} />
      );
  } else if (giphy.status === "error") {
    body = (
      <div className="flex flex-col items-center px-4 py-8 text-center">
        <p className="text-[14px] font-semibold text-[var(--tt-text)]">Couldn&apos;t load stickers</p>
        <button
          type="button"
          onClick={giphy.reload}
          className="mt-3 h-9 rounded-full bg-[var(--tt-field)] px-5 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] focus-visible:outline-2 focus-visible:outline-white/60"
        >
          Try again
        </button>
      </div>
    );
  } else if (giphy.status === "loading") {
    body = (
      <div aria-hidden className="grid grid-cols-4 gap-2">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="aspect-square rounded-[var(--chat-radius-control)]" />
        ))}
      </div>
    );
  } else if (giphy.stickers.length === 0) {
    body = (
      <p className="px-4 py-8 text-center text-[14px] text-[var(--tt-text-muted)]">
        {searching ? "No stickers found." : "No stickers yet."}
      </p>
    );
  } else {
    body = <StickerButtons stickers={giphy.stickers} onPick={pick} busy={busy} />;
  }

  const tabClass = (active: boolean) =>
    cn(
      "flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[20px] leading-none transition-colors focus-visible:outline-2 focus-visible:outline-white/70",
      active ? "bg-white/[0.14]" : "hover:bg-white/[0.08]",
    );

  return (
    <>
      <div className="sticky top-0 z-10 -mx-3 -mt-3 mb-2 bg-[var(--chat-pop)] px-3 pt-3 pb-1">
        <input
          type="text"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          placeholder="Search GIPHY stickers"
          aria-label="Search GIPHY stickers"
          autoComplete="off"
          spellCheck={false}
          maxLength={50}
          className="h-9 w-full rounded-full bg-white/[0.06] px-4 text-[14px] text-[var(--tt-text)] caret-[var(--tt-text)] placeholder:text-[var(--tt-placeholder)] focus-visible:outline-2 focus-visible:outline-white/40"
        />
        <div role="group" aria-label="Sticker sections" className="no-scrollbar mt-2 flex gap-1 overflow-x-auto">
          <button
            type="button"
            aria-label="Recent stickers"
            aria-pressed={!searching && section === "recent"}
            title="Recent"
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => {
              setTyped("");
              setSection("recent");
            }}
            className={cn(tabClass(!searching && section === "recent"), "text-[var(--chat-meta)]")}
          >
            <Clock aria-hidden className="h-[18px] w-[18px]" />
          </button>
          {STICKER_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              aria-label={c.label}
              aria-pressed={!searching && section === c.id}
              title={c.label}
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                setTyped("");
                setSection(c.id);
              }}
              className={tabClass(!searching && section === c.id)}
            >
              <span aria-hidden>{c.emoji}</span>
            </button>
          ))}
        </div>
      </div>
      <h3 className="px-0.5 pb-2 text-[13px] font-semibold text-[var(--chat-meta)]">{heading}</h3>
      {body}
      <p className="pt-2 text-center text-[11px] font-semibold tracking-wide text-[var(--chat-meta)]">Powered by GIPHY</p>
    </>
  );
}

function StickerButtons({
  stickers,
  onPick,
  busy,
}: {
  stickers: StickerView[];
  onPick: (sticker: StickerView) => void;
  busy: boolean;
}) {
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
          className="flex aspect-square items-center justify-center rounded-[var(--chat-radius-control)] p-1.5 transition-colors hover:bg-[var(--chat-active)] focus-visible:outline-2 focus-visible:outline-white/70 disabled:opacity-50"
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- a small public image from the sticker host; next/image would need that host allow-listed */}
          <img src={sticker.url} alt="" width={sticker.width} height={sticker.height} loading="lazy" decoding="async" referrerPolicy="no-referrer" className="h-full w-full object-contain" />
        </button>
      ))}
    </div>
  );
}
