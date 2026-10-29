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
  draft = "",
  onDraftChange,
  onTyping,
  onSend,
  onSendSticker,
  reply = null,
  onCancelReply,
}: {
  disabled: boolean;
  disabledReason?: string;
  /** Text to start from, and where to report changes: the draft outlives this component (a block unmounts it). */
  draft?: string;
  onDraftChange?: (text: string) => void;
  /**
   * The person typed (true) or the box emptied, was sent or lost focus (false). Only what they did
   * triggers it: a draft restored after a failed send, or focus alone, does not.
   */
  onTyping?: (typing: boolean) => void;
  reply?: ReplyDraft | null;
  onCancelReply?: () => void;
  onSend: (content: string) => Promise<boolean>;
  onSendSticker: (sticker: StickerView) => Promise<boolean>;
}) {
  const [text, setText] = useState(draft);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stickerSending, setStickerSending] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const root = useRef<HTMLDivElement>(null);
  /** Synchronous twin of `stickerSending`: two clicks in one frame both see the state as idle. */
  const stickerInFlight = useRef(false);

  useEffect(() => {
    onDraftChange?.(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reports changes of the text only
  }, [text]);

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
    onTyping?.(false);
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
    const next = text.slice(0, start) + insert + text.slice(end);
    setText(next);
    onTyping?.(next.trim() !== "");
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
    <div ref={root} className="relative flex-none px-3 pt-1 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {pickerOpen && !disabled && (
        <div className="absolute right-5 bottom-full left-5 z-20 mb-2 ml-auto max-w-[372px] tt-768:right-3 tt-768:left-3 tt-768:max-w-none">
          <ChatPicker onEmoji={insertAtCaret} onSticker={(sticker) => void sendSticker(sticker)} stickerBusy={busy} />
        </div>
      )}

      {/* One surface: the reply being written sits in its top, the box and its buttons below. */}
      <div
        className={cn(
          "overflow-hidden rounded-[var(--chat-radius-surface)] border bg-[var(--chat-raised)] transition-[border-color,box-shadow] duration-150 motion-reduce:transition-none",
          "border-[var(--chat-line)] focus-within:border-[var(--chat-line-strong)] focus-within:shadow-[0_0_0_3px_rgb(255_255_255_/_0.05)]",
          disabled && "opacity-60",
        )}
      >
        {reply && onCancelReply && <ReplyBar draft={reply} onCancel={onCancelReply} />}

        <div className="flex items-end gap-1 py-1.5 pr-1.5 pl-4">
          <textarea
            ref={field}
            rows={1}
            value={text}
            disabled={disabled}
            onChange={(event) => {
              setText(event.target.value);
              onTyping?.(event.target.value.trim() !== "");
            }}
            onBlur={() => onTyping?.(false)}
            onKeyDown={(event) => {
              if (event.key !== "Enter" || event.shiftKey) return;
              if (event.nativeEvent.isComposing || event.keyCode === 229) return;
              event.preventDefault();
              void submit();
            }}
            placeholder={disabled ? (disabledReason ?? "Messaging unavailable") : reply ? "Reply to message…" : "Message…"}
            aria-label={reply ? "Reply to message" : "Message"}
            className="max-h-[132px] min-h-[36px] flex-1 resize-none bg-transparent py-[7px] text-[15px] leading-[22px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)] disabled:cursor-not-allowed"
          />
          <button
            type="button"
            onClick={() => setPickerOpen((open) => !open)}
            disabled={disabled}
            aria-label="Emoji and stickers"
            aria-expanded={pickerOpen}
            aria-haspopup="dialog"
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)]",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70 disabled:cursor-not-allowed disabled:opacity-50",
              pickerOpen && "bg-[var(--chat-active)] text-[var(--tt-text)]",
            )}
          >
            <EmojiIcon className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={() => void submit()}
            disabled={!canSend}
            aria-label="Send message"
            aria-busy={sending}
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full text-white transition-[background-color,transform,opacity] duration-150 motion-reduce:transition-none",
              "bg-[var(--chat-own)] hover:bg-[var(--chat-own-pressed)] active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              "disabled:cursor-default disabled:bg-white/10 disabled:text-white/35 disabled:active:scale-100",
            )}
          >
            {sending ? (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
            ) : (
              <ArrowPostIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {text.length >= COUNTER_FROM && (
        <p
          className={cn(
            "mt-1.5 pr-3 text-right text-[12px] leading-4",
            text.length > MAX_MESSAGE_LENGTH ? "text-[var(--tt-red)]" : "text-[var(--chat-meta)]",
          )}
        >
          {text.length}/{MAX_MESSAGE_LENGTH}
        </p>
      )}
    </div>
  );
}
