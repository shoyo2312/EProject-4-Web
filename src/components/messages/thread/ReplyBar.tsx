"use client";

import { CloseIcon } from "@/components/icons";

export interface ReplyDraft {
  messageId: string;
  /** Who wrote the original: "You" or the other person's name. */
  author: string;
  /** One line of it, or "Sticker". */
  text: string;
}

/**
 * The strip over the composer while a reply is being written: who and what is being answered, and a
 * cross that drops the reply — and only the reply: whatever was typed stays in the box.
 */
export function ReplyBar({ draft, onCancel }: { draft: ReplyDraft; onCancel: () => void }) {
  return (
    <div className="flex items-center gap-3 px-1 pb-2 text-[14px] leading-5 text-[var(--tt-text-muted)]">
      <p className="min-w-0 flex-1 truncate">
        <span className="font-semibold">{draft.author}:</span> {draft.text}
      </p>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="flex h-7 w-7 flex-none items-center justify-center rounded-full hover:bg-[var(--tt-shape-neutral-3)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-white/60"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
