"use client";

import { BUTTON_DANGER, BUTTON_PRIMARY, BUTTON_QUIET, DIALOG_SHEET } from "@/components/messages/chat-ui";
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
    <Modal onClose={busy ? () => {} : onCancel} className={DIALOG_SHEET}>
      <h2 className="text-center text-[19px] leading-6 font-bold text-[var(--tt-text)]">{title}</h2>
      <div className="mt-3 text-center text-[14px] leading-[21px] text-[var(--chat-meta)]">{children}</div>
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
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={cn("flex-1", danger ? BUTTON_DANGER : BUTTON_PRIMARY)}
        >
          {busy ? busyLabel : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
