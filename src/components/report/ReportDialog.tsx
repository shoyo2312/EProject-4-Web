"use client";

import { useState } from "react";

import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
} from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import {
  submitReport,
  type ReportReason,
  type ReportTargetType,
} from "@/lib/api/reports";

/**
 * The report sheet, shared by every target type: pick a scenario from the list,
 * read back what that scenario covers, then submit. The second step is the
 * point — it is the only chance to bounce a mistaken report before it reaches a
 * moderator's queue.
 *
 * 700 × 509, header 72, footer 84 — measured on the live report sheet, which is
 * the same sheet whether the target is a video or a comment. The body scrolls
 * between them, so a long scenario list never resizes the sheet.
 */
export function ReportDialog({
  targetType,
  targetId,
  reasons,
  onClose,
}: {
  targetType: ReportTargetType;
  /** For COMMENT this is `"videoId:commentId"` — see admin-service `CommentTarget`. */
  targetId: string;
  reasons: readonly ReportReason[];
  onClose: () => void;
}) {
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const close = () => {
    if (submitting) return;
    onClose();
  };

  const submit = () => {
    if (!reason) return;
    setSubmitting(true);
    submitReport(targetType, targetId, reason.label)
      .then(() => {
        onClose();
        toast.success("Thanks for the report. We'll take a look.");
      })
      .catch(() => toast.error("Couldn't send the report. Please try again."))
      .finally(() => setSubmitting(false));
  };

  return (
    <Modal onClose={close} className="w-[700px] rounded-[8px]">
      <div className="flex h-[509px] max-h-[calc(100vh-4rem)] flex-col">
        <div className="flex h-[72px] flex-none items-center gap-0 px-6">
          {reason && (
            <button
              type="button"
              onClick={() => setReason(null)}
              disabled={submitting}
              aria-label="Back"
              className="flex h-8 w-8 flex-none items-center justify-center text-[var(--tt-text)] disabled:opacity-60"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}
          <h2 className="flex-1 text-[20px] font-bold leading-8 text-[var(--tt-text)]">
            Report
          </h2>
          <button
            type="button"
            onClick={close}
            disabled={submitting}
            aria-label="Close"
            className="flex h-8 w-8 flex-none items-center justify-center text-[var(--tt-text)] disabled:opacity-60"
          >
            <CloseIcon className="h-[14px] w-[14px]" />
          </button>
        </div>

        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-white/[0.12]">
          {reason ? (
            <>
              {/* The chosen scenario, restated full-bleed over a lighter band
                  before the rules it covers. */}
              <p className="bg-white/[0.08] px-6 py-4 text-[18px] leading-6 text-[var(--tt-text)]">
                {reason.label}
              </p>
              <div className="px-4 py-4">
                <p className="text-[16px] leading-[22px] text-[var(--tt-text)]">
                  We don&apos;t allow the following
                </p>
                <ul className="mt-2 list-disc pl-6 text-[16px] leading-[22px] text-[var(--tt-text)]">
                  {reason.bullets.map((rule) => (
                    <li key={rule} className="mt-2">
                      {rule}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          ) : (
            <div className="px-4 pt-4">
              <p className="px-2 text-[14px] leading-[18px] text-[var(--tt-text-secondary)]">
                Please select a scenario
              </p>
              {reasons.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setReason(option)}
                  className="flex h-[54px] w-full items-center justify-between gap-4 rounded-[8px] p-2 text-left text-[16px] leading-[22px] text-[var(--tt-text)] transition-colors hover:bg-white/[0.08]"
                >
                  {option.label}
                  <ChevronRightIcon className="h-4 w-4 flex-none" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* The footer only exists once there is something to submit — the
            scenario list on the live sheet has none. */}
        {reason && (
          <div className="flex h-[84px] flex-none items-center justify-end border-t border-white/20 px-6">
            <button
              type="button"
              onClick={submit}
              disabled={submitting}
              className="h-9 rounded-[4px] bg-[var(--tt-red-active)] px-4 text-[16px] leading-[22px] text-white transition-colors hover:bg-[var(--tt-red)] disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
}
