"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { CloseIcon } from "@/components/icons";
import { ReportMessagePicker } from "@/components/messages/report/ReportMessagePicker";
import { useSession } from "@/components/session/SessionProvider";
import { MODAL_EXIT_MS, modalCardMotion, modalOverlayMotion } from "@/components/ui/modal";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import { isApiError } from "@/lib/api/errors";
import { submitDirectMessageReport } from "@/lib/api/reports";
import {
  CHAT_REPORT_REASONS,
  newReportRequestId,
  reportErrorMessage,
  toggleSelection,
  type ChatReportReason,
  type Selection,
} from "@/lib/chat-report";
import { cn } from "@/lib/utils";

type Step = "reason" | "select" | "done";

/**
 * Report a conversation: pick a reason, pick 1-50 messages, send, then be thanked. Nothing is sent
 * before Submit (choosing a reason and Next only move on), and "Thanks for reporting" is shown only
 * once the server has answered that the report and its evidence are stored. The flow is its own
 * layer in `document.body`, so it works the same from the inbox, the floating panel and the full page,
 * and closing it leaves the thread behind exactly as it was.
 */
export function ReportFlow({
  conversationId,
  name,
  onClose,
}: {
  conversationId: string;
  name: string;
  onClose: () => void;
}) {
  const { user } = useSession();
  const [step, setStep] = useState<Step>("reason");
  const [reason, setReason] = useState<ChatReportReason | null>(null);
  const [selected, setSelected] = useState<Selection>(new Set());
  const [limitReached, setLimitReached] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [closing, setClosing] = useState(false);
  // One key per attempt at the same report: a retry after a lost answer finds the report it made.
  const requestId = useRef<string | null>(null);
  const sending = useRef(false);

  const close = useCallback(() => {
    setClosing(true);
    window.setTimeout(onClose, MODAL_EXIT_MS);
  }, [onClose]);

  const toggle = (id: string) => {
    const { next, full } = toggleSelection(selected, id);
    setSelected(next);
    setLimitReached(full);
    // Another choice is another report: its retries must not return the old one.
    requestId.current = null;
    setError(null);
  };

  const submit = async () => {
    if (!reason || selected.size === 0 || sending.current) return;
    sending.current = true;
    setSubmitting(true);
    setError(null);
    requestId.current ??= newReportRequestId();
    try {
      await submitDirectMessageReport(conversationId, reason, [...selected], requestId.current);
      setStep("done");
    } catch (cause) {
      setError(reportErrorMessage(cause));
      if (isApiError(cause) && cause.code === "REPORT_EVIDENCE_UNAVAILABLE") {
        setReloadKey((n) => n + 1);
      }
    } finally {
      sending.current = false;
      setSubmitting(false);
    }
  };

  const mounted = useMounted();
  if (!mounted) return null;
  return createPortal(
    step === "select" && reason ? (
      <Layer closing={closing} labelledBy="report-picker-title" onEscape={() => !submitting && close()} full>
        <ReportMessagePicker
          conversationId={conversationId}
          me={user?.userId ?? ""}
          reasonLabel={reason}
          selected={selected}
          limitReached={limitReached}
          submitting={submitting}
          error={error}
          reloadKey={reloadKey}
          onToggle={toggle}
          onBack={() => {
            setError(null);
            setStep("reason");
          }}
          onClose={close}
          onSubmit={() => void submit()}
        />
      </Layer>
    ) : step === "done" ? (
      <Layer closing={closing} labelledBy="report-done-title" onEscape={close} className="w-[400px] rounded-[12px] p-6 text-center">
        <Check aria-hidden className="mx-auto h-9 w-9 text-[#20d5a0]" strokeWidth={3} />
        <h2 id="report-done-title" className="mt-6 text-[22px] leading-7 font-bold text-[var(--tt-text)]">
          Thanks for reporting
        </h2>
        <p className="mt-4 text-[15px] leading-[21px] font-medium text-[var(--tt-text)]">
          We&apos;ll review your report and if there is a violation of our Community Guidelines, we&apos;ll take
          appropriate action.
        </p>
        <button
          type="button"
          onClick={close}
          autoFocus
          className="mt-6 h-12 w-full rounded-[4px] bg-[var(--tt-red-active)] text-[16px] font-semibold text-white hover:bg-[var(--tt-red)]"
        >
          Done
        </button>
      </Layer>
    ) : (
      <Layer closing={closing} labelledBy="report-title" onEscape={close} className="w-[700px] rounded-[8px] p-6">
        <div className="flex items-center">
          <h2 id="report-title" className="flex-1 text-[24px] leading-8 font-bold text-[var(--tt-text)]">
            Report
          </h2>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center text-[var(--tt-text)]"
          >
            <CloseIcon className="h-[16px] w-[16px]" />
          </button>
        </div>
        <p className="mt-5 text-[16px] leading-[22px] font-medium text-[var(--tt-text)]">
          Why are you reporting {name || "this account"}?
        </p>
        <div role="radiogroup" aria-label="Report reason" className="mt-4 flex flex-wrap gap-3">
          {CHAT_REPORT_REASONS.map((label) => {
            const on = reason === label;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setReason(label)}
                className={cn(
                  "h-11 rounded-full px-4 text-[15px] leading-5 font-semibold transition-colors",
                  on ? "bg-white text-[#121212]" : "bg-white/[0.08] text-[var(--tt-text)] hover:bg-white/[0.14]",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={close}
            className="h-10 w-[164px] rounded-[4px] bg-white/[0.08] text-[16px] font-semibold text-[var(--tt-text)] hover:bg-white/[0.14]"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!reason}
            onClick={() => setStep("select")}
            className="h-10 w-[164px] rounded-[4px] bg-[var(--tt-red-active)] text-[16px] font-semibold text-white hover:bg-[var(--tt-red)] disabled:bg-white/[0.08] disabled:text-[var(--chat-meta)]"
          >
            Next
          </button>
        </div>
      </Layer>
    ),
    document.body,
  );
}

/** One layer of the flow: dimmed backdrop and a sheet that fades in and, on close, out before it unmounts. */
function Layer({
  closing,
  labelledBy,
  onEscape,
  full = false,
  className,
  children,
}: {
  closing: boolean;
  labelledBy: string;
  onEscape: () => void;
  full?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEscapeKey(onEscape);
  useFocusTrap(ref);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    return () => previous?.focus?.();
  }, []);
  return (
    <div
      className={cn(
        "fixed inset-0 z-[3001] flex items-center justify-center motion-reduce:transition-none",
        full ? "bg-black" : "bg-black/[0.68]",
        modalOverlayMotion(closing),
      )}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={cn(
          full
            ? "h-full w-full"
            : cn(
                "relative max-h-[calc(100vh-2rem)] max-w-[calc(100vw-2rem)] overflow-y-auto bg-[#121212] shadow-[0_2px_12px_rgba(0,0,0,0.4)] motion-reduce:transition-none",
                modalCardMotion(closing),
              ),
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
