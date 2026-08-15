"use client";

import { useEffect, useState } from "react";

import { CloseIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { ActivityGroup, ActivityNotification } from "@/types/tiktok";

/**
 * `.DivDrawerContainer` — extracted verbatim:
 *
 *   --drawer-animation-duration: 400ms;
 *   --drawer-animation-easing: ease;
 *   width: var(--drawer-content-width, 20rem);   → 320px
 *   height: 100vh; position: fixed; top: 0;
 *   inset-inline-start: 4.5rem;                  → 72px, beside the collapsed nav
 *   background-color: var(--ui-page-flat-1);
 *   z-index: 99;
 *   border-inline: 1px solid rgba(255,255,255,.12);
 *   overscroll-behavior: contain;
 *   visibility: hidden; pointer-events: none;
 *
 *   .drawer-enter        { transform: translateX(-24rem); opacity: .3 }
 *   .drawer-enter-active { transform: translateX(0);      opacity: 1  }
 *   .drawer-exit         { transform: translateX(0);      opacity: 1  }
 *   .drawer-exit-active  { transform: translateX(-24rem); opacity: .3;
 *                          transition: transform 400ms ease, opacity 400ms ease }
 *
 * Unlike the comment sidebar this **overlays** the feed — it is `position:
 * fixed`, and the 240px sidebar placeholder does not change. Verified live: the
 * article stayed at x=240, width 1616px, padding 64/176 with the drawer both
 * open and closed. The only thing that moves is the fixed sidebar itself,
 * which collapses 15rem → 4.5rem.
 *
 * `visibility` is included in the transition on purpose: it flips to visible
 * immediately on open but holds until the end of the 400ms on close, so the
 * panel does not disappear mid-slide.
 */
export function ActivityDrawer({
  open,
  filters,
  groups,
  onClose,
}: {
  open: boolean;
  filters: readonly string[];
  groups: ActivityGroup[];
  onClose: () => void;
}) {
  const [filter, setFilter] = useState<string>(filters[0]);

  // Not extracted from the live site — a baseline affordance for a fixed
  // overlay that would otherwise only be dismissable by re-clicking the nav.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <div
      aria-hidden={!open}
      className={cn(
        "fixed top-0 z-[99] h-screen w-80 overscroll-contain bg-[var(--tt-page)]",
        "left-18 border-x border-[var(--tt-divider)]",
        // `transform`, not Tailwind's `translate-x-*`: in v4 those compile to the
        // `translate` property, which `transition-[transform]` does not cover —
        // the slide snapped instantly while opacity eased.
        "transition-[transform,opacity,visibility] duration-[400ms] ease-[ease]",
        open
          ? "visible opacity-100 [transform:translateX(0)]"
          : "invisible opacity-30 [transform:translateX(-24rem)] [pointer-events:none]",
      )}
    >
      {/* `.DivDrawerCloseButtonContainer` — absolute, top 1.5rem, end 1rem.
          The button itself is 28×28, rgba(255,255,255,.13), radius 999px. */}
      <div className="absolute end-4 top-6 z-[1] flex items-center justify-center">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close notifications"
          className="flex h-7 w-7 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* `.DivInboxContainer` — height 100%, flex column, padding 20px 8px 0, gap 16 */}
      <div className="flex h-full flex-col gap-4 px-2 pb-0 pt-5">
        {/* `.DivInboxHeaderContainer` — flex column, gap 16, flex 0 0 auto */}
        <div className="flex flex-none flex-col gap-4 px-2">
          {/* `.H2InboxTitle` — TikTokDisplayFont 20px/25px/600 */}
          <h2 className="flex text-[20px] font-semibold leading-[25px] text-[var(--tt-text)]">
            Notifications
          </h2>

          {/* `.DivGroupContainer` — flex wrap, gap 12px 8px */}
          <div className="flex flex-wrap gap-x-2 gap-y-3">
            {filters.map((label) => (
              <FilterChip
                key={label}
                label={label}
                selected={filter === label}
                onSelect={() => setFilter(label)}
              />
            ))}
          </div>
        </div>

        {/* `.DivInboxContentContainer` — flex 1 1 auto, overflow auto, with an
            8px negative end margin so the scrollbar sits outside the padding. */}
        <div className="no-scrollbar -me-2 flex-1 overflow-auto pe-2">
          {groups.map((group) => (
            <div key={group.title}>
              {/* `.PTimeGroupTitle` — 14px/600/18px, padding 0 8px 4px */}
              <p className="px-2 pb-1 text-[14px] font-semibold leading-[18px] text-[var(--tt-text)]">
                {group.title}
              </p>
              <ul>
                {group.items.map((item) => (
                  <li key={item.id} className="mb-4 last:mb-0">
                    <NotificationItem item={item} />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * `.ButtonGroupItem` — padding 6px 12px, border-radius 999px, 14px/600/18px.
 *   selected   color #121212 on rgba(255,255,255,.9)
 *   unselected color rgba(255,255,255,.9) on rgba(255,255,255,.08)
 *   :hover     background rgba(255,255,255,.12)
 */
function FilterChip({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-pressed={selected}
      className={cn(
        "cursor-pointer rounded-full px-3 py-1.5 text-center text-[14px] font-semibold leading-[18px] transition-colors",
        selected
          ? "bg-[rgb(255_255_255_/_0.9)] text-[#121212]"
          : "bg-[rgb(255_255_255_/_0.08)] text-[var(--tt-text)] hover:bg-[rgb(255_255_255_/_0.12)]",
      )}
    >
      {label}
    </button>
  );
}

/**
 * `.DivSystemNotifItemContainer` — flex row, align-items center, height 72px,
 * padding 0 8px, cursor pointer, `:hover { background: rgb(37,37,37) }`.
 *   `.DivSystemNotifIconContainer`     48×48, radius 24px, bg rgb(50,54,75)
 *   `.DivContentContainer`             padding 0 8px 0 0, flex 1 1 auto, min-width 0
 *   `.PTitleText`                      14px/600/18px, line-clamp 1
 *   `.PSystemNotifDescText`            13px/400/17px, line-clamp 1
 *   `.DivSystemNotifTrailingContainer` padding-left 12px, gap 10px, flex-shrink 0
 *   `TUXAlertBadgeDot`                 6px, #fe2c55, radius 999px
 */
function NotificationItem({ item }: { item: ActivityNotification }) {
  return (
    <div className="flex h-[72px] cursor-pointer flex-row items-center px-2 transition-colors hover:bg-[rgb(37,37,37)]">
      <div className="flex h-12 w-12 min-w-12 items-center justify-center rounded-3xl bg-[rgb(50,54,75)]">
        <BellGlyph />
      </div>

      <div className="min-w-0 flex-1 pe-2 ps-3">
        <p className="truncate text-[14px] font-semibold leading-[18px] text-[var(--tt-text)]">
          {item.title}
        </p>
        <p className="truncate text-[13px] leading-[17px] text-[var(--tt-text)]">
          {item.description}
        </p>
      </div>

      <div className="flex flex-shrink-0 items-center justify-center gap-2.5 ps-3">
        {item.unread && (
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--tt-red)]" />
        )}
      </div>
    </div>
  );
}

/** Reconstruction — the live icon comes from the unreadable TUX sprite. */
function BellGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6 text-white" fill="currentColor">
      <path d="M24 4a3 3 0 0 0-3 3v1.3A13 13 0 0 0 11 21v8.2l-2.7 4.3A2 2 0 0 0 10 36.5h28a2 2 0 0 0 1.7-3l-2.7-4.3V21a13 13 0 0 0-10-12.7V7a3 3 0 0 0-3-3Zm-5 36a5 5 0 0 0 10 0H19Z" />
    </svg>
  );
}
