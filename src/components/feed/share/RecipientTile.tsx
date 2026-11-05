"use client";

import { Check } from "lucide-react";

import { ChatAvatar } from "@/components/messages/ChatAvatar";

import { cn } from "@/lib/utils";
import type { ShareRecipient } from "@/lib/share-recipients";

/**
 * One person in the sheet's first row. Pressing it picks or unpicks them (by user id, so a renamed
 * or re-sorted row keeps its picks). A person who cannot take the video is dimmed with the reason in
 * its tooltip, one who already got it says "Sent", one whose send failed says why.
 */
export function RecipientTile({
  recipient,
  selected,
  sent,
  disabledReason,
  failure,
  busy,
  onToggle,
}: {
  recipient: ShareRecipient;
  selected: boolean;
  sent: boolean;
  disabledReason: string | null;
  failure: string | undefined;
  busy: boolean;
  onToggle: () => void;
}) {
  const unavailable = disabledReason !== null || sent;
  const note = sent ? "Sent" : (failure ?? disabledReason);
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={selected}
      aria-label={recipient.author.nickname}
      aria-describedby={note ? `${recipient.userId}-note` : undefined}
      disabled={unavailable || busy}
      onClick={onToggle}
      title={failure ?? disabledReason ?? undefined}
      className={cn(
        "flex w-[88px] flex-none flex-col items-center px-3 pb-2 pt-3 focus-visible:outline-2 focus-visible:outline-white/60",
        unavailable && "opacity-50",
      )}
    >
      <span className="flex w-16 flex-col items-center gap-1.5">
        <span className="relative h-16 w-16 flex-none">
          <ChatAvatar src={recipient.author.avatarUrl} className="h-16 w-16" />
          {(selected || sent) && (
            <span
              aria-hidden
              className="absolute -right-0.5 -bottom-0.5 flex h-6 w-6 items-center justify-center rounded-full border-2 border-[#1e1e1e] bg-[var(--tt-red)] text-white"
            >
              <Check className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          )}
        </span>
        <span className="w-16 truncate text-center text-[12px] leading-[15.6px] font-normal text-[var(--tt-text)]">
          {recipient.author.nickname}
        </span>
        {note && (
          <span
            id={`${recipient.userId}-note`}
            className={cn(
              "w-16 truncate text-center text-[11px] leading-3",
              failure ? "text-[var(--tt-red)]" : "text-[var(--tt-text-muted)]",
            )}
          >
            {sent ? "Sent" : failure ? "Failed" : "Unavailable"}
          </span>
        )}
      </span>
    </button>
  );
}
