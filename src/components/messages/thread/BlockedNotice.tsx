"use client";

import { Ban } from "lucide-react";

import { BUTTON_PRIMARY, ICON_DISC, NOTICE_CARD } from "@/components/messages/chat-ui";

/**
 * Stands where the composer would be while the viewer has blocked the other person. Blocking closes
 * the conversation in both directions, so there is nothing to type into — but the way out has to be
 * right here, not only in Settings. The history is untouched; unblocking reopens the composer and
 * nothing else (follows ended by the block are not brought back).
 */
export function BlockedNotice({
  name,
  busy,
  error,
  onUnblock,
}: {
  name: string;
  busy: boolean;
  error: string | null;
  onUnblock: () => void;
}) {
  return (
    <div className="flex-none px-5 pt-2 pb-4 tt-768:px-3">
      <div className={`flex items-center gap-3 px-4 py-3.5 ${NOTICE_CARD}`}>
        <span className={ICON_DISC}>
          <Ban aria-hidden className="h-[18px] w-[18px]" />
        </span>
        <p className="min-w-0 flex-1 text-[14px] leading-5 text-[var(--chat-meta)]">
          You blocked {name}. You can&apos;t message each other until you unblock them.
        </p>
        <button
          type="button"
          onClick={onUnblock}
          disabled={busy}
          aria-busy={busy}
          className={`h-9 flex-none rounded-full px-4 text-[14px] ${BUTTON_PRIMARY.replace("h-11", "h-9").replace("rounded-[var(--chat-radius-control)]", "rounded-full")}`}
        >
          {busy ? "Unblocking…" : "Unblock"}
        </button>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-[13px] leading-4 text-[var(--tt-red)]">
          {error}
        </p>
      )}
    </div>
  );
}
