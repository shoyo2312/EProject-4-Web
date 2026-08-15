"use client";

import { SPEEDS } from "@/components/player/PlayerSettingsProvider";
import { cn } from "@/lib/utils";

/**
 * The shared shell and rows of the player's overflow menu.
 *
 * Two surfaces open this menu and they do not carry the same rows — the feed's
 * right-click menu ends in Download/Share/Copy link, `/video/[id]`'s three-dot
 * menu ends in Not interested/Report — so what is shared is the chrome and the
 * row vocabulary, and each caller composes its own list.
 *
 * Laid out from `docs/design-references/tiktok.com/more-menu.png` and the two
 * feed captures beside it: 44px rows, an outline icon then its label, with a
 * full-bleed divider before the trailing group. Only the speed group and the
 * auto-scroll switch carry a trailing control.
 *
 * Colours read off those screenshots (~1.15× scale, so measurements are divided
 * back down): panel #252525, segmented-group and switch track #3f3f3f,
 * selected speed pill #111.
 */
export const MENU_WIDTH = 320;

export function PlayerMenuPanel({
  ref,
  className,
  style,
  children,
}: {
  ref?: React.Ref<HTMLDivElement>;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <div
      ref={ref}
      role="menu"
      style={{ width: MENU_WIDTH, ...style }}
      className={cn(
        "overflow-hidden rounded-[8px] bg-[#252525] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * One 44px row: icon, label, and an optional trailing control. Rows that act on
 * click are buttons; the Speed row has no click of its own (its pills do), so
 * it falls back to a plain div.
 */
export function MenuRow({
  icon,
  label,
  onClick,
  checked,
  trailing,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  /** Present only on the switch row, which is a menu*itemcheckbox*. */
  checked?: boolean;
  trailing?: React.ReactNode;
}) {
  const content = (
    <>
      <span className="flex-none text-[var(--tt-icon)]">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {trailing}
    </>
  );

  const className =
    "flex h-11 w-full items-center gap-3 px-3 text-left text-[15px] text-[var(--tt-text)]";

  if (!onClick) {
    return <div className={className}>{content}</div>;
  }

  return (
    <button
      type="button"
      role={checked === undefined ? "menuitem" : "menuitemcheckbox"}
      aria-checked={checked}
      onClick={onClick}
      className={cn(className, "transition-colors hover:bg-[var(--tt-field)]")}
    >
      {content}
    </button>
  );
}

/** Full-bleed in the reference — it runs edge to edge, not inset to the label. */
export function MenuDivider() {
  return <div className="my-1 h-px bg-[var(--tt-divider)]" />;
}

/** The whole steps render as "1.0" and "2.0"; the rest already have decimals. */
const formatSpeed = (speed: number) =>
  Number.isInteger(speed) ? speed.toFixed(1) : String(speed);

/** The segmented speed group: one track, the current step filled dark. */
export function SpeedPills({
  speed,
  onSpeedChange,
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Speed"
      className="flex flex-none items-center rounded-full bg-[#3f3f3f] p-0.5"
    >
      {SPEEDS.map((value) => {
        const selected = value === speed;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onSpeedChange(value)}
            className={cn(
              "h-6 rounded-full px-2 text-[13px] transition-colors",
              selected
                ? "bg-[#111] font-semibold text-white"
                : "text-[rgba(255,255,255,0.75)] hover:text-white",
            )}
          >
            {formatSpeed(value)}
          </button>
        );
      })}
    </div>
  );
}

/** Read-only visual — the row that owns it is the button. */
export function Switch({ on }: { on: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex h-6 w-[42px] flex-none items-center rounded-full p-0.5 transition-colors",
        on ? "bg-[var(--tt-red)]" : "bg-[#3f3f3f]",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full bg-white transition-transform",
          on && "translate-x-[18px]",
        )}
      />
    </span>
  );
}

/**
 * The static "Auto ›" on the Quality row. It is inert: the clone ships one file
 * per video (see docs/research/tiktok.com/ASSETS.md), so there is no rendition
 * ladder to pick from — the row exists because the reference has it.
 */
export function QualityValue() {
  return (
    <span className="flex flex-none items-center gap-1 text-[15px] text-[var(--tt-text-secondary)]">
      Auto
      <svg viewBox="0 0 24 24" aria-hidden className="h-4 w-4">
        <path
          d="m9.5 5.5 6.5 6.5-6.5 6.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}
