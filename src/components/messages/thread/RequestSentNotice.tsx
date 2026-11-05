import { MessagesSquare } from "lucide-react";

import { ICON_DISC, NOTICE_CARD } from "@/components/messages/chat-ui";
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
    <div className="flex-none px-5 pt-2 pb-4 tt-768:px-3">
      <div role="status" className={`flex items-start gap-3 px-4 py-3.5 ${NOTICE_CARD}`}>
        <span className={ICON_DISC}>
          <MessagesSquare aria-hidden className="h-[18px] w-[18px]" strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <p className="text-[15px] leading-5 font-semibold text-[var(--tt-text)]">Chat request sent</p>
          <p className="mt-0.5 text-[13px] leading-[19px] text-[var(--chat-meta)]">
            You can keep chatting as soon as they accept. If they haven&apos;t responded or have declined by{" "}
            {date ?? `${REQUEST_RETRY_DAYS} days from now`}, you can send 1 more message to ask again.
          </p>
        </div>
      </div>
    </div>
  );
}
