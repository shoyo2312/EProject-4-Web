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
    <div key={draft.messageId} className="flex items-center gap-3 motion-safe:animate-chat-bar-in border-b border-[var(--chat-line)] py-2.5 pr-2.5 pl-4">
      <span aria-hidden className="h-8 w-[3px] flex-none rounded-full bg-[var(--chat-own)]" />
      <p className="min-w-0 flex-1">
        <span className="block truncate text-[12px] leading-4 font-semibold text-[var(--tt-text-secondary)]">{draft.author}:</span>
        <span className="block truncate text-[13.5px] leading-[19px] text-[var(--chat-meta)]">{draft.text}</span>
      </p>
      <button
        type="button"
        onClick={onCancel}
        aria-label="Cancel reply"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-white/70"
      >
        <CloseIcon className="h-4 w-4" />
      </button>
    </div>
  );
}
