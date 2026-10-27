import { MessagesSquare } from "lucide-react";

import { REQUEST_RETRY_DAYS } from "@/lib/chat";

/**
 * Where the composer was, once the one message a message request allows has been sent. From this
 * side a request that is ignored and one that was deleted look the same, so the text promises
 * nothing about either: it says what happens on accept, and when one more message may be sent.
 * The server decides all of it through `sendPermission` and `retryAvailableAt`, so it survives a
 * reload, another tab and a call that skips the UI.
 */
export function RequestSentNotice({ retryAvailableAt }: { retryAvailableAt: string | null }) {
  const date = retryAvailableAt
    ? new Date(retryAvailableAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <div
      role="status"
      className="flex flex-none items-center gap-3 border-t border-[var(--tt-divider)] bg-white/[0.04] px-4 py-3.5 tt-768:px-3"
    >
      <MessagesSquare aria-hidden className="h-9 w-9 flex-none text-[var(--tt-mention)]" strokeWidth={1.6} />
      <div className="min-w-0">
        <p className="text-[15px] leading-5 font-bold text-[var(--tt-text)]">Chat request sent</p>
        <p className="mt-0.5 text-[13px] leading-[18px] text-[var(--tt-text-muted)]">
          You can keep chatting as soon as they accept. If they haven&apos;t responded or have declined by{" "}
          {date ?? `${REQUEST_RETRY_DAYS} days from now`}, you can send 1 more message to ask again.
        </p>
      </div>
    </div>
  );
}
