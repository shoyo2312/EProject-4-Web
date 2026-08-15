"use client";

import Image from "next/image";
import { useEffect } from "react";
import {

  CodeXml,
  Link as LinkGlyph,
  Mail,
  MessageCircle,
  Repeat2,
  Search,
  Send,
} from "lucide-react";

import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import { SHARE_FRIENDS, SHARE_TARGETS } from "@/lib/mock-feed";
import type { Author, ShareTarget } from "@/types/tiktok";

/**
 * The share sheet is a **modal**, not a popover — clicking the rail's share
 * button mounts a full-viewport `.TUXModal` overlay. Measured live at 1920×936:
 *
 *   overlay   position: fixed, inset 0, z-index 3500,
 *             background: rgba(0,0,0,.7), flex column, centred, padding 16px
 *   dialog    480 × 333, background: rgb(30,30,30), border-radius: 12px
 *   navbar    .TUXModalNavBar, 52px tall, padding: 0 8px
 *             ├ 44×44 icon button (search)
 *             ├ h2 "Share to"  17px / 500 / 25.5px
 *             └ 44×44 icon button (close)
 *   body      flex column, gap 12px
 *             ├ friends row     128 tall, inner scroller 124, overflow-x auto
 *             ├ divider         1px, rgba(255,255,255,.19)
 *             └ targets row     128 tall, inner scroller 124, overflow-x auto
 *
 * 52 + (128 + 12 + 1 + 12 + 128) = 333, i.e. the dialog height is fully
 * accounted for by these numbers.
 *
 * Both rows reuse **one** tile shape — the friends row and the targets row
 * differ only in what fills the 64px slot:
 *
 *   tile                  88 × 124
 *   .DivActionContainer   padding: 12px 12px 8px
 *   .DivAction            flex column, gap 6px, width 64
 *   ├ icon / avatar       64 × 64  (avatar is border-radius 50%)
 *   └ label               12px / 400 / 15.6px, centred, #f6f6f6
 */
export function ShareSheet({
  shares,
  onClose,
}: {
  /** Rendered into the title row's count on the live sheet's parent button. */
  shares: number;
  onClose: () => void;
}) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Share to — ${shares} shares`}
      onClick={onClose}
      className="fixed inset-0 z-[3500] flex flex-col items-center justify-center overflow-auto bg-black/70 p-4"
    >
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-[480px] flex-none rounded-[12px] bg-[#1e1e1e]"
      >
        {/* `.TUXModalNavBar` — 44px slots either side of a centred title. */}
        <div className="flex h-[52px] items-center px-2">
          <button
            type="button"
            aria-label="Search friends"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[4px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <Search className="h-6 w-6" strokeWidth={2} />
          </button>
          <h2 className="flex-1 text-center text-[17px] font-medium leading-[25.5px] text-[var(--tt-text)]">
            Share to
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-11 w-11 flex-none items-center justify-center rounded-[4px] text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <CloseIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex flex-col gap-3">
          <ScrollRow>
            {SHARE_FRIENDS.map((friend) => (
              <FriendTile key={friend.username} friend={friend} />
            ))}
          </ScrollRow>

          <div className="h-px bg-[rgba(255,255,255,0.19)]" />

          <ScrollRow>
            {SHARE_TARGETS.map((target) => (
              <TargetTile key={target.id} target={target} />
            ))}
          </ScrollRow>
        </div>
      </div>
    </div>
  );
}

/** 128px row wrapping a 124px horizontal scroller — the 4px is the hidden bar. */
function ScrollRow({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-32">
      <div className="no-scrollbar flex h-[124px] overflow-x-auto px-3">
        {children}
      </div>
    </div>
  );
}

function Tile({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      className="flex w-[88px] flex-none flex-col items-center px-3 pb-2 pt-3"
    >
      <span className="flex w-16 flex-col items-center gap-1.5">
        {children}
        <span className="w-16 truncate text-center text-[12px] font-normal leading-[15.6px] text-[var(--tt-text)]">
          {label}
        </span>
      </span>
    </button>
  );
}

function FriendTile({ friend }: { friend: Author }) {
  return (
    <Tile label={friend.nickname}>
      <Image
        src={friend.avatarUrl}
        alt=""
        width={64}
        height={64}
        className="h-16 w-16 rounded-full object-cover"
      />
    </Tile>
  );
}

/**
 * The live tile draws each service's own logo inside a 64px disc. Those are
 * third-party trademarks — and not TikTok's assets to begin with — so the clone
 * does **not** reproduce them. Instead every disc keeps the measured 64px size,
 * spacing and label, and gets:
 *   - the neutral field colour plus a Lucide glyph, for the actions TikTok owns
 *     (Repost, Copy, Embed, Email);
 *   - the service's brand colour plus either a *generic* Lucide glyph where one
 *     reads unambiguously (a speech bubble for WhatsApp, a paper plane for
 *     Telegram) or the service's initial where it does not.
 * The layout is therefore faithful even though the marks deliberately are not.
 *
 * Lucide v1 dropped its brand icons (no `Facebook`, `Twitter`, `Linkedin`), so
 * substituting logos from the icon set was not an option regardless.
 */
function TargetTile({ target }: { target: ShareTarget }) {
  const Glyph = NATIVE_GLYPHS[target.id];

  return (
    <Tile label={target.label}>
      <span
        className={cn(
          "flex h-16 w-16 flex-none items-center justify-center rounded-full",
          !target.tint && "bg-[var(--tt-field)]",
        )}
        style={target.tint ? { backgroundColor: target.tint } : undefined}
      >
        {Glyph ? (
          <Glyph className="h-7 w-7 text-[var(--tt-text)]" strokeWidth={2} />
        ) : (
          <span className="text-[24px] font-bold leading-none text-white">
            {target.label.charAt(0)}
          </span>
        )}
      </span>
    </Tile>
  );
}

/** Tiles that get a glyph; every other tile falls back to its initial. */
const NATIVE_GLYPHS: Record<
  string,
  React.ComponentType<{ className?: string; strokeWidth?: number }> | undefined
> = {
  repost: Repeat2,
  copy: LinkGlyph,
  embed: CodeXml,
  email: Mail,
  whatsapp: MessageCircle,
  telegram: Send,
};
