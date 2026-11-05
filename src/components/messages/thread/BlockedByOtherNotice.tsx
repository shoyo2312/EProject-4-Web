"use client";

import { Ban } from "lucide-react";

import { ICON_DISC, NOTICE_CARD } from "@/components/messages/chat-ui";

/**
 * Stands where the composer would be when messaging is closed by a block the viewer cannot lift: the
 * other account's, or one of the two when both blocked. It does not say whose, and offers no action —
 * a block is only ever removed by the account that placed it. History stays readable above it.
 */
export function BlockedByOtherNotice() {
  return (
    <div className="flex-none px-5 pt-2 pb-4 tt-768:px-3">
      <div role="status" className={`flex items-center gap-3 px-4 py-3.5 ${NOTICE_CARD}`}>
        <span className={ICON_DISC}>
          <Ban aria-hidden className="h-[18px] w-[18px]" />
        </span>
        <p className="text-[14px] leading-5 text-[var(--chat-meta)]">You can&apos;t message this account.</p>
      </div>
    </div>
  );
}
