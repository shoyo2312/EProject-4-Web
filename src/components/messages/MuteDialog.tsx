"use client";

import { BUTTON_DANGER, BUTTON_QUIET, DIALOG_SHEET } from "@/components/messages/chat-ui";
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
    <Modal onClose={busy ? () => {} : onCancel} className={DIALOG_SHEET}>
      <h2 className="text-center text-[19px] leading-6 font-bold text-[var(--tt-text)]">
        Mute notifications from {name}?
      </h2>
      <p className="mt-3 text-center text-[14px] leading-[21px] text-[var(--chat-meta)]">
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
              "flex h-11 items-center gap-3 rounded-[var(--chat-radius-control)] px-4 text-left text-[15px] text-[var(--tt-text)] transition-colors disabled:opacity-50",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70",
              length === option.value ? "bg-white/[0.1] ring-1 ring-[var(--chat-line-strong)]" : "bg-white/[0.05] hover:bg-white/[0.09]",
            )}
          >
            <span
              aria-hidden
              className={cn(
                "flex h-4 w-4 flex-none items-center justify-center rounded-full border",
                length === option.value ? "border-[var(--chat-own)]" : "border-white/40",
              )}
            >
              {length === option.value && <span className="h-2 w-2 rounded-full bg-[var(--chat-own)]" />}
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
          className={cn("flex-1", BUTTON_QUIET)}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => onConfirm(length)}
          disabled={busy}
          aria-busy={busy}
          className={cn("flex-1", BUTTON_DANGER)}
        >
          {busy ? "Muting…" : "Mute"}
        </button>
      </div>
    </Modal>
  );
}
