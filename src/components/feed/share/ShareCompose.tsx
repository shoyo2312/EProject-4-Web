"use client";

import { MAX_VIDEO_NOTE } from "@/lib/chat";
import type { ReopenAsk } from "@/hooks/use-share-send";
import type { ShareRecipient } from "@/lib/share-recipients";

/**
 * What takes the place of the share targets once someone is picked: the optional note and "Send (N)".
 * Failures are listed by name under the note, so the ones to retry are in front of the viewer.
 */
export function ShareCompose({
  count,
  note,
  onNote,
  sending,
  failures,
  names,
  onSend,
}: {
  count: number;
  note: string;
  onNote: (value: string) => void;
  sending: boolean;
  failures: Readonly<Record<string, string>>;
  names: ReadonlyMap<string, string>;
  onSend: () => void;
}) {
  const failed = Object.entries(failures);
  return (
    <div className="flex h-32 flex-col px-4 pb-4">
      <textarea
        value={note}
        onChange={(event) => onNote(event.target.value)}
        maxLength={MAX_VIDEO_NOTE}
        disabled={sending}
        placeholder="Write a message…"
        aria-label="Message to send with the video"
        className="min-h-0 flex-1 resize-none bg-transparent text-[15px] leading-5 text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-text-secondary)] disabled:opacity-60"
      />
      {failed.length > 0 && (
        <ul role="alert" className="mb-1 max-h-10 overflow-y-auto text-[12px] leading-4 text-[var(--tt-red)]">
          {failed.map(([userId, reason]) => (
            <li key={userId}>
              {names.get(userId) ?? "Someone"}: {reason}
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-none items-center justify-end gap-3">
        {note.length >= MAX_VIDEO_NOTE - 40 && (
          <span className="text-[12px] text-[var(--tt-text-muted)]">
            {note.length}/{MAX_VIDEO_NOTE}
          </span>
        )}
        <button
          type="button"
          onClick={onSend}
          disabled={count === 0 || sending}
          aria-busy={sending}
          className="h-9 rounded-[6px] bg-[var(--tt-red)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          {sending ? "Sending…" : failed.length > 0 ? `Retry (${count})` : `Send (${count})`}
        </button>
      </div>
    </div>
  );
}

/**
 * The question before a send that reopens a request the viewer deleted. It names who, and answering
 * No leaves the picks and the note exactly as they are.
 */
export function ReopenQuestion({ ask }: { ask: ReopenAsk }) {
  const names = ask.recipients.map((recipient: ShareRecipient) => recipient.author.nickname).join(", ");
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="reopen-title"
      className="absolute inset-0 z-10 flex items-center justify-center rounded-[12px] bg-black/60 p-4"
    >
      <div className="w-full rounded-[12px] bg-[#2a2a2a] p-5">
        <h3 id="reopen-title" className="text-center text-[16px] leading-6 font-bold text-[var(--tt-text)]">
          Let {names} message you again?
        </h3>
        <p className="mt-2 text-center text-[13px] leading-5 text-[var(--tt-text-muted)]">
          You deleted their message requests. Sending now lets them reply and chat with you freely. Cancel to
          send nothing — your picks and message stay as they are.
        </p>
        <div className="mt-4 flex gap-3">
          <button
            type="button"
            onClick={() => ask.answer(false)}
            autoFocus
            className="h-10 flex-1 rounded-[6px] bg-white/[0.08] text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/[0.14] focus-visible:outline-2 focus-visible:outline-white/60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => ask.answer(true)}
            className="h-10 flex-1 rounded-[6px] bg-[var(--tt-red)] text-[14px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] focus-visible:outline-2 focus-visible:outline-white"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
