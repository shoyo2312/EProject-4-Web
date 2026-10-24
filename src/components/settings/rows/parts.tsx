"use client";

import { ChevronRightIcon, TriangleDownIcon } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

export const ROW_CLASS =
  "flex w-full items-center gap-4 border-b border-[var(--tt-divider)] px-4 py-3 text-left last:border-b-0";

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
 */
export function Switch({
  on,
  label,
  onToggle,
  disabled,
}: {
  on: boolean;
  label: string;
  onToggle: () => void;
  /** For a control the browser will never let through. */
  disabled?: boolean;
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
          "h-5 w-5 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.15)] transition-transform",
          on && "translate-x-5",
        )}
      />
    </button>
  );
}
