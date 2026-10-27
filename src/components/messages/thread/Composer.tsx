"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ArrowPostIcon, EmojiIcon } from "@/components/icons";
import { ChatPicker } from "@/components/messages/thread/ChatPicker";
import { ReplyBar, type ReplyDraft } from "@/components/messages/thread/ReplyBar";
import { useDismiss } from "@/hooks/use-dismiss";
import type { StickerView } from "@/lib/api/conversations";
import { MAX_MESSAGE_LENGTH, isSendable } from "@/lib/chat";
import { cn } from "@/lib/utils";

/** Past this many characters the counter appears; before it there is nothing to count. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;

/**
 * Enter sends, Shift+Enter breaks the line. While an IME composition is open (Vietnamese Telex
 * and VNI, Japanese, Chinese) Enter belongs to the IME — it commits the syllable — so it must
 * not send; `isComposing` covers modern browsers and keyCode 229 covers Safari, which fires
 * `keydown` after `compositionend`.
 *
 * The text is cleared as soon as it is handed over and restored if the send fails, so a
 * refused message is never lost.
 *
 * The emoji/sticker button opens the picker above the box. An emoji lands at the caret (or over the
 * selection) and sends nothing. A sticker is its own message: the draft is left exactly as it was,
 * whatever happens to the sticker, and a second press while one is in flight does nothing.
 *
 * While `reply` is set a strip names the message being answered. Dropping it with its cross keeps the
 * draft; the reply itself is released by whoever owns it (`ThreadBody`) once a send has succeeded, so
 * a refused or cancelled send leaves both the text and the reply where they were.
 */
export function Composer({
  disabled,
  disabledReason,
  onSend,
  onSendSticker,
  reply = null,
  onCancelReply,
}: {
  disabled: boolean;
  disabledReason?: string;
  reply?: ReplyDraft | null;
  onCancelReply?: () => void;
  onSend: (content: string) => Promise<boolean>;
  onSendSticker: (sticker: StickerView) => Promise<boolean>;
}) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stickerSending, setStickerSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  /** Synchronous twin of `stickerSending`: two clicks in one frame both see the state as idle. */
  const stickerInFlight = useRef(false);

  useEffect(() => {
    const el = field.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }, [text]);

  const replyId = reply?.messageId;
  useEffect(() => {
    if (replyId) field.current?.focus();
  }, [replyId]);

  const closePicker = useCallback(() => setPickerOpen(false), []);
  useDismiss(root, pickerOpen, closePicker);

  const busy = sending || stickerSending;
  const canSend = !disabled && !busy && isSendable(text);

  const submit = async () => {
    if (!canSend) return;
    const content = text.trim();
    setText("");
    setSending(true);
    const ok = await onSend(content);
    setSending(false);
    if (!ok) setText((current) => current || content);
    field.current?.focus();
  };

  /** At the caret, replacing any selection, then back into the box with the caret after it. */
  const insertAtCaret = (insert: string) => {
    const el = field.current;
    const start = el?.selectionStart ?? text.length;
    const end = el?.selectionEnd ?? text.length;
    setText(text.slice(0, start) + insert + text.slice(end));
    const caret = start + insert.length;
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(caret, caret);
    });
  };

  const sendSticker = async (sticker: StickerView) => {
    if (disabled || busy || stickerInFlight.current) return;
    stickerInFlight.current = true;
    setStickerSending(true);
    try {
      const ok = await onSendSticker(sticker);
      if (ok) setPickerOpen(false);
    } finally {
      stickerInFlight.current = false;
      setStickerSending(false);
    }
  };

  return (
    <div ref={root} className="relative flex-none px-4 pt-2 pb-4 tt-768:px-3">
      {pickerOpen && !disabled && (
        <div className="absolute right-4 bottom-full left-4 z-20 mb-1 ml-auto max-w-[360px] tt-768:right-3 tt-768:left-3">
          <ChatPicker onEmoji={insertAtCaret} onSticker={(sticker) => void sendSticker(sticker)} stickerBusy={busy} />
        </div>
      )}

      {reply && onCancelReply && <ReplyBar draft={reply} onCancel={onCancelReply} />}

      <div
        className={cn(
          "flex items-end gap-2 rounded-[22px] border border-[var(--tt-divider)] bg-[var(--tt-field)] py-1.5 pr-1.5 pl-4",
          "focus-within:border-white/40",
          disabled && "opacity-60",
        )}
      >
        <textarea
          ref={field}
          rows={1}
          value={text}
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter" || event.shiftKey) return;
            if (event.nativeEvent.isComposing || event.keyCode === 229) return;
            event.preventDefault();
            void submit();
          }}
          placeholder={disabled ? (disabledReason ?? "Messaging unavailable") : reply ? "Reply to message…" : "Message…"}
          aria-label={reply ? "Reply to message" : "Message"}
          className="max-h-[120px] min-h-[28px] flex-1 resize-none bg-transparent py-1 text-[15px] leading-5 text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)] disabled:cursor-not-allowed"
        />
        <button
          type="button"
          onClick={() => setPickerOpen((open) => !open)}
          disabled={disabled}
          aria-label="Emoji and stickers"
          aria-expanded={pickerOpen}
          aria-haspopup="dialog"
          className={cn(
            "flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]",
            "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/60 disabled:cursor-not-allowed disabled:opacity-50",
            pickerOpen && "bg-[var(--tt-shape-neutral-3)]",
          )}
        >
          <EmojiIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={!canSend}
          aria-label="Send message"
          className={cn(
            "flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--tt-red)] text-white transition-[background-color,opacity] duration-150",
            "hover:bg-[var(--tt-red-hover)] active:bg-[var(--tt-red-active)]",
            "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
            "disabled:cursor-default disabled:bg-white/15 disabled:text-white/40",
          )}
        >
          <ArrowPostIcon className="h-4 w-4" />
        </button>
      </div>
      {text.length >= COUNTER_FROM && (
        <p
          className={cn(
            "mt-1 pr-3 text-right text-[12px] leading-4",
            text.length > MAX_MESSAGE_LENGTH ? "text-[var(--tt-red)]" : "text-[var(--tt-text-muted)]",
          )}
        >
          {text.length}/{MAX_MESSAGE_LENGTH}
        </p>
      )}
    </div>
  );
}
