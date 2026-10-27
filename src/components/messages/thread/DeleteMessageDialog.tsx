"use client";

import { Modal } from "@/components/ui/modal";

/**
 * Two different things behind one trash can. "Delete for you" only takes the message out of the
 * viewer's own history; the other person keeps it. "Recall" — offered on the viewer's own messages
 * only — takes it back for everyone, and leaves a "recalled" notice in its place.
 */
export function DeleteMessageDialog({
  canRecall,
  busy,
  onHide,
  onRecall,
  onCancel,
}: {
  canRecall: boolean;
  busy: boolean;
  onHide: () => void;
  onRecall: () => void;
  onCancel: () => void;
}) {
  const option =
    "flex w-full flex-col rounded-[8px] bg-white/[0.06] px-4 py-3 text-left transition-colors hover:bg-white/[0.12] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60";

  return (
    <Modal onClose={busy ? () => {} : onCancel} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[18px] leading-6 font-bold text-[var(--tt-text)]">Delete message?</h2>
      <div className="mt-5 flex flex-col gap-2" aria-busy={busy}>
        {canRecall && (
          <button type="button" onClick={onRecall} disabled={busy} className={option}>
            <span className="text-[15px] font-semibold text-[var(--tt-red)]">Recall for everyone</span>
            <span className="mt-0.5 text-[13px] leading-4 text-[var(--tt-text-muted)]">
              Takes the message back for everyone in this chat. They will see that it was recalled.
            </span>
          </button>
        )}
        <button type="button" onClick={onHide} disabled={busy} className={option}>
          <span className="text-[15px] font-semibold text-[var(--tt-text)]">Delete for you</span>
          <span className="mt-0.5 text-[13px] leading-4 text-[var(--tt-text-muted)]">
            Removes the message from your view only. The other person can still see it.
          </span>
        </button>
      </div>
      <button
        type="button"
        onClick={onCancel}
        disabled={busy}
        className="mt-3 h-11 w-full rounded-[6px] bg-white/[0.08] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60"
      >
        Cancel
      </button>
    </Modal>
  );
}
