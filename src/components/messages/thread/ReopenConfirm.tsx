"use client";

import { Modal } from "@/components/ui/modal";

/**
 * Shown before the first message into a request the viewer deleted. Sending reopens the thread, so
 * the other person can reply and chat freely; the viewer should know that before they press send.
 * Cancelling sends nothing and changes nothing: the other person stays unable to message them.
 */
export function ReopenConfirm({
  name,
  busy,
  onCancel,
  onConfirm,
}: {
  name: string;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={busy ? () => {} : onCancel} className="w-[400px] rounded-[12px] p-6">
      <h2 className="text-center text-[18px] leading-6 font-bold text-[var(--tt-text)]">
        Let {name} message you again?
      </h2>
      <p className="mt-3 text-center text-[14px] leading-5 text-[var(--tt-text-muted)]">
        You deleted {name}&apos;s message request. If you send a message now, {name} will be able to reply and
        chat with you freely. If you don&apos;t want that, cancel — they stay unable to message you.
      </p>
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
          className="h-11 flex-1 rounded-[6px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white"
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </Modal>
  );
}
