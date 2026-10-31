"use client";

import { BUTTON_PRIMARY, BUTTON_QUIET, DIALOG_SHEET } from "@/components/messages/chat-ui";
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
    <Modal onClose={busy ? () => {} : onCancel} className={DIALOG_SHEET}>
      <h2 className="text-center text-[19px] leading-6 font-bold text-[var(--tt-text)]">
        Let {name} message you again?
      </h2>
      <p className="mt-3 text-center text-[14px] leading-[21px] text-[var(--chat-meta)]">
        You deleted {name}&apos;s message request. If you send a message now, {name} will be able to reply and
        chat with you freely. If you don&apos;t want that, cancel — they stay unable to message you.
      </p>
      <div className="mt-6 flex gap-3">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className={`flex-1 ${BUTTON_QUIET}`}
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          aria-busy={busy}
          className={`flex-1 ${BUTTON_PRIMARY}`}
        >
          {busy ? "Sending…" : "Send message"}
        </button>
      </div>
    </Modal>
  );
}
