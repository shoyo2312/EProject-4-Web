"use client";

import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";

/**
 * A yes/no question over the page. Nothing happens until the confirm button is pressed; Cancel,
 * Escape and a click outside all close it without a request. While the request is out both buttons
 * are held, so it cannot be sent twice, and a refusal stays on screen with the dialog so it can be retried.
 */
export function ConfirmDialog({
  title,
  children,
  confirmLabel,
  busyLabel,
  danger = false,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  busyLabel: string;
  danger?: boolean;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={busy ? () => {} : onCancel} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[18px] leading-6 font-bold text-[var(--tt-text)]">{title}</h2>
      <div className="mt-3 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">{children}</div>
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
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={cn(
            "h-11 flex-1 rounded-[6px] text-[15px] font-semibold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white",
            danger
              ? "bg-[var(--tt-red)] text-white hover:bg-[var(--tt-red-hover)]"
              : "bg-white text-black hover:bg-white/90",
          )}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
