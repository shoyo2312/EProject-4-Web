"use client";

import type { ReactNode } from "react";

import { ChevronRightIcon, TriangleDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

export const ROW_CLASS =
  "flex w-full items-center gap-4 border-b border-[var(--tt-divider)] px-4 py-3 text-left last:border-b-0";

/**
 * A row that opens in place onto `children`. As on the live panel the caret is
 * a filled triangle that keeps pointing down, open or not, and a `heading` row
 * sets its title as a group heading ("In-app notifications").
 */
export function ExpandRow({
  row,
  expanded,
  onToggle,
  children,
}: {
  row: SettingsRow;
  expanded: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const heading = row.kind === "expand" && row.heading;

  return (
    <div className="border-b border-[var(--tt-divider)] last:border-b-0">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={onToggle}
        className="flex w-full items-center gap-4 px-4 py-3 text-left hover:bg-white/[0.03]"
      >
        {heading ? (
          <span className="min-w-0 flex-1 text-[18px] leading-6 font-semibold text-[var(--tt-text)]">
            {row.title}
          </span>
        ) : (
          <RowBody row={row} />
        )}
        <TriangleDownIcon className="h-5 w-5 flex-none text-[rgb(255_255_255/0.6)]" />
      </button>

      {expanded && children}
    </div>
  );
}

export function RowBody({ row, note }: { row: SettingsRow; note?: string }) {
  return (
    <div className="min-w-0 flex-1">
      <p className="text-[16px] leading-[21px] text-[var(--tt-text)]">
        {row.title}
      </p>
      {row.description && (
        <p className="mt-1 max-w-[583px] text-[12px] leading-[15.6px] text-[rgb(255_255_255/0.6)]">
          {row.description}
        </p>
      )}
      {note && (
        <p className="mt-1 max-w-[583px] text-[12px] leading-[15.6px] text-[var(--tt-red-active)]">
          {note}
        </p>
      )}
    </div>
  );
}

/** `value` overrides a `value` row's static text with the account's own. */
export function Accessory({ row, value }: { row: SettingsRow; value?: string }) {
  if (row.kind === "expand") {
    return (
      <TriangleDownIcon className="h-5 w-5 flex-none text-[rgb(255_255_255/0.6)]" />
    );
  }

  return (
    <div className="flex flex-none items-center gap-2">
      {row.kind === "value" && (
        <span className="text-[16px] leading-[20.8px] text-[rgb(255_255_255/0.6)]">
          {value ?? row.value}
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 text-[rgb(255_255_255/0.6)]" />
    </div>
  );
}

/**
 * `.DivSwitchWrapper` — 44 × 24 track, 20px knob inset 2px, `#0BE09B` when on.
 * Green, not the brand red: `/setting` is the only page in the app using it.
 * The Daily screen time page draws the same switch with a dark knob.
 */
export function Switch({
  on,
  label,
  onToggle,
  disabled,
  darkKnob = false,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
  /** For a control the browser will never let through. */
  disabled?: boolean;
  darkKnob?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors",
        on ? "bg-[#0be09b]" : "bg-white/[0.12]",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "h-5 w-5 rounded-full transition-transform",
          darkKnob ? "bg-[#121212]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}
