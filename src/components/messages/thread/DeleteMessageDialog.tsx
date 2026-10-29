"use client";

import { BUTTON_QUIET, DIALOG_SHEET, ICON_DISC } from "@/components/messages/chat-ui";
import { EyeOff, Undo2 } from "lucide-react";

import { cn } from "@/lib/utils";
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
    "flex w-full items-center gap-3 rounded-[var(--chat-radius-control)] bg-white/[0.05] px-3.5 py-3 text-left transition-colors hover:bg-white/[0.1] disabled:cursor-default disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/70";

  return (
    <Modal onClose={busy ? () => {} : onCancel} className={DIALOG_SHEET}>
      <h2 className="text-center text-[19px] leading-6 font-bold text-[var(--tt-text)]">Delete message?</h2>
      <div className="mt-5 flex flex-col gap-2" aria-busy={busy}>
        {canRecall && (
          <button type="button" onClick={onRecall} disabled={busy} className={option}>
            <span className={cn(ICON_DISC, "bg-[var(--chat-own)]/15 text-[#ff7a93]")}>
              <Undo2 aria-hidden className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] leading-5 font-semibold text-[#ff7a93]">Recall for everyone</span>
              <span className="mt-0.5 block text-[13px] leading-[18px] text-[var(--chat-meta)]">
                Takes the message back for everyone in this chat. They will see that it was recalled.
              </span>
            </span>
          </button>
        )}
        <button type="button" onClick={onHide} disabled={busy} className={option}>
          <span className={ICON_DISC}>
            <EyeOff aria-hidden className="h-[18px] w-[18px]" />
          </span>
          <span className="min-w-0">
            <span className="block text-[15px] leading-5 font-semibold text-[var(--tt-text)]">Delete for you</span>
            <span className="mt-0.5 block text-[13px] leading-[18px] text-[var(--chat-meta)]">
              Removes the message from your view only. The other person can still see it.
            </span>
          </span>
        </button>
      </div>
      <button type="button" onClick={onCancel} disabled={busy} className={cn("mt-3 w-full", BUTTON_QUIET)}>
        Cancel
      </button>
    </Modal>
  );
}
