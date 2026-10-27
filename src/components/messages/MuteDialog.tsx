"use client";

import { useState } from "react";

import { Modal } from "@/components/ui/modal";
import type { MuteLength } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";

const OPTIONS: { value: MuteLength; label: string }[] = [
  { value: "ONE_HOUR", label: "1 hour" },
  { value: "EIGHT_HOURS", label: "8 hours" },
  { value: "TWENTY_FOUR_HOURS", label: "24 hours" },
  { value: "INDEFINITE", label: "Until I change it" },
];

/**
 * Four lengths and nothing else. The messages keep arriving and can be read as always; what stops is
 * the nudging — desktop notifications and chat bubbles popping up — for this conversation only.
 * Cancel, Escape and a click outside change nothing.
 */
export function MuteDialog({
  name,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (length: MuteLength) => void;
}) {
  const [length, setLength] = useState<MuteLength>("ONE_HOUR");

  return (
    <Modal onClose={busy ? () => {} : onCancel} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[18px] leading-6 font-bold text-[var(--tt-text)]">
        Mute notifications from {name}?
      </h2>
      <p className="mt-3 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        You will still receive and be able to read their messages. You just won&apos;t get alerts from this
        conversation for the time you choose.
      </p>
      <div role="radiogroup" aria-label="Mute for" className="mt-4 flex flex-col gap-1.5">
        {OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={length === option.value}
            disabled={busy}
            onClick={() => setLength(option.value)}
            className={cn(
              "flex h-11 items-center gap-3 rounded-[8px] bg-white/[0.06] px-4 text-left text-[15px] text-[var(--tt-text)] transition-colors hover:bg-white/[0.12] disabled:opacity-50",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 flex-none items-center justify-center rounded-full border",
                length === option.value ? "border-[var(--tt-red)]" : "border-white/40",
              )}
            >
              {length === option.value && <span className="h-2 w-2 rounded-full bg-[var(--tt-red)]" />}
            </span>
            {option.label}
          </button>
        ))}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-center text-[13px] leading-4 text-[var(--tt-red)]">
          {error}
        </p>
      )}
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="h-11 flex-1 rounded-[6px] bg-white/[0.08] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(length)}
          disabled={busy}
          aria-busy={busy}
          className="h-11 flex-1 rounded-[6px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          {busy ? "Muting…" : "Mute"}
        </button>
      </div>
    </Modal>
  );
}
