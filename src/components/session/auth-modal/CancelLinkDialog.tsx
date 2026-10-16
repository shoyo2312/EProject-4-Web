"use client";

import { useRef } from "react";

import { useFocusTrap } from "@/hooks/use-focus-trap";

/**
 * "Cancel verification?" — asked when Escape, the backdrop or the close button
 * would end a social link challenge, because that throws away the provider
 * token the mailed code is checked against. Drawn over the modal's card, not
 * as a second modal.
 */
export function CancelLinkDialog({
  onKeep,
  onCancel,
}: {
  onKeep: () => void;
  onCancel: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  return (
    <div
      ref={dialogRef}
      role="alertdialog"
      aria-modal="true"
      aria-label="Cancel verification?"
      className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-[#1e1e1e] px-10 text-center"
    >
      <h3 className="text-[18px] leading-6 font-bold text-[var(--tt-text)]">
        Cancel verification?
      </h3>
      <p className="text-[14px] leading-5 text-[var(--tt-text-secondary)]">
        You&rsquo;ll need to request a new code to log in.
      </p>
      <div className="mt-2 flex w-full flex-col gap-2">
        <button
          type="button"
          onClick={onKeep}
          className="h-11 w-full rounded-[2px] bg-[var(--tt-text)] text-[16px] font-semibold text-[#1e1e1e] transition-opacity hover:opacity-90"
        >
          Keep verifying
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="h-11 w-full rounded-[2px] bg-white/[0.08] text-[16px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.13]"
        >
          Cancel verification
        </button>
      </div>
    </div>
  );
}
