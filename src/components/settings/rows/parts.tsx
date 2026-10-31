"use client";

import type { ReactNode } from "react";

import { ChevronRightIcon, TriangleDownIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
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

/**
 * `value` overrides a `value` row's static text with the account's own;
 * `loading` puts a placeholder there while that answer is on its way.
 */
export function Accessory({
  row,
  value,
  loading,
}: {
  row: SettingsRow;
  value?: string;
  loading?: boolean;
}) {
  if (row.kind === "expand") {
    return (
      <TriangleDownIcon className="h-5 w-5 flex-none text-[rgb(255_255_255/0.6)]" />
    );
  }

  return (
    <div className="flex flex-none items-center gap-2">
      {loading && <Skeleton className="h-4 w-14" />}
      {!loading && row.kind === "value" && (
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
 * Two pages draw it otherwise, as live does: Daily screen time with a dark
 * knob, and Sleep hours as a 48 × 28 cyan (#20D5EC) track with a 22px knob,
 * on `rgba(255,255,255,.32)` when off.
 */
export function Switch({
  on,
  label,
  onToggle,
  disabled,
  variant,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
  /** For a control the browser will never let through. */
  disabled?: boolean;
  variant?: "daily" | "sleep";
}) {
  const sleep = variant === "sleep";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onToggle}
      disabled={disabled}
      className={cn(
        "flex flex-none items-center rounded-full transition-colors",
        sleep ? "h-7 w-12 p-[3px]" : "h-6 w-11 p-0.5",
        on ? (sleep ? "bg-[#20d5ec]" : "bg-[#0be09b]") : sleep ? "bg-white/[0.32]" : "bg-white/[0.12]",
        disabled && "opacity-50",
      )}
    >
      <span
        className={cn(
          "rounded-full transition-transform",
          sleep ? "h-[22px] w-[22px]" : "h-5 w-5",
          variant === "daily" ? "bg-[#121212]" : "bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)]",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}
