"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

import { ImagePlus } from "lucide-react";

import { ArrowPostIcon, CloseIcon, EmojiIcon } from "@/components/icons";
import { ChatPicker } from "@/components/messages/thread/ChatPicker";
import { ReplyBar, type ReplyDraft } from "@/components/messages/thread/ReplyBar";
import { useDismiss } from "@/hooks/use-dismiss";
import type { ImageView, StickerView } from "@/lib/api/conversations";
import { isApiError } from "@/lib/api/errors";
import { MAX_MESSAGE_LENGTH, chatErrorMessage, isSendable } from "@/lib/chat";
import {
  IMAGE_ACCEPT,
  MAX_CAPTION_LENGTH,
  MAX_IMAGE_MB,
  firstImage,
  imageFileError,
} from "@/lib/chat-image";
import { cn } from "@/lib/utils";

/** Past this many characters the counter appears; before it there is nothing to count. */
const COUNTER_FROM = MAX_MESSAGE_LENGTH - 200;

/** What `onSendImage` is given: an uploaded picture, its optional caption and the key that makes a retry safe. */
export interface ImageSend {
  imageId: string;
  content?: string;
  clientRequestId: string;
}

export type ImageSendResult = { ok: true } | { ok: false; error: unknown };

/** A picture chosen but not sent. It outlives a failed send, so retrying needs nothing chosen again. */
interface ImageDraft {
  file: File;
  previewUrl: string;
  /** Set once the server has stored it; a retry after a failed send does not upload twice. */
  uploaded: ImageView | null;
  /** One per draft: a send repeated after a lost response returns the first message, not a second. */
  clientRequestId: string;
  phase: "idle" | "uploading" | "sending";
  error: string | null;
}

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
 * The photo button, a paste and a drop only make a draft: a thumbnail tray above the box, with the box
 * as the caption. Nothing is sent until the person sends. Upload and send are two steps with their own
 * states; a failure in either keeps the picture and the caption and offers a retry, and the same
 * `clientRequestId` goes with every attempt, so a retry cannot post it twice. The draft belongs to the
 * conversation it was made in (the thread keys this component by conversation).
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
  onUploadImage,
  onSendImage,
  incomingFile = null,
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
  /** Stores a picture for this conversation. Without it (and `onSendImage`) the composer offers no photos. */
  onUploadImage?: (file: File, signal: AbortSignal) => Promise<ImageView>;
  onSendImage?: (image: ImageSend) => Promise<ImageSendResult>;
  /** A file dropped on the thread; a new object each time, so the same file can be dropped twice. */
  incomingFile?: { file: File } | null;
}) {
  const [text, setText] = useState(draft);
  const [sending, setSending] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [stickerSending, setStickerSending] = useState(false);
  const [image, setImage] = useState<ImageDraft | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const photoInputId = useId();
  const imageInFlight = useRef(false);
  const uploadAbort = useRef<AbortController | null>(null);
  const photos = onUploadImage !== undefined && onSendImage !== undefined;
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

  const imageUrl = image?.previewUrl;
  useEffect(
    () => () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );
  useEffect(() => () => uploadAbort.current?.abort(), []);

  const chooseImage = useCallback(
    (file: File) => {
      if (!photos || disabled || imageInFlight.current) return;
      const problem = imageFileError(file);
      if (problem) {
        setPickError(problem);
        return;
      }
      setPickError(null);
      setImage({
        file,
        previewUrl: URL.createObjectURL(file),
        uploaded: null,
        clientRequestId: crypto.randomUUID(),
        phase: "idle",
        error: null,
      });
      field.current?.focus();
    },
    [photos, disabled],
  );

  const dropped = incomingFile?.file;
  useEffect(() => {
    if (dropped) chooseImage(dropped);
  }, [dropped, chooseImage]);

  const removeImage = () => {
    if (image?.phase === "sending") return;
    uploadAbort.current?.abort();
    imageInFlight.current = false;
    setImage(null);
    setPickError(null);
  };

  const closePicker = useCallback(() => setPickerOpen(false), []);
  useDismiss(root, pickerOpen, closePicker);

  const imageBusy = image !== null && image.phase !== "idle";
  const busy = sending || stickerSending || imageBusy;
  const captionOk = text.trim().length <= MAX_CAPTION_LENGTH;
  const canSend = !disabled && !busy && (image ? captionOk : isSendable(text));

  /** Upload (once), then send. Any failure leaves the draft, the caption and the key as they were. */
  const submitImage = async (draft: ImageDraft) => {
    if (!onUploadImage || !onSendImage || imageInFlight.current) return;
    imageInFlight.current = true;
    onTyping?.(false);
    const abort = new AbortController();
    uploadAbort.current = abort;
    const fail = (message: string | null, reset?: Partial<ImageDraft>) =>
      setImage((current) => (current ? { ...current, ...reset, phase: "idle", error: message } : current));
    try {
      let uploaded = draft.uploaded;
      if (!uploaded) {
        setImage((current) => (current ? { ...current, phase: "uploading", error: null } : current));
        uploaded = await onUploadImage(draft.file, abort.signal);
        const stored = uploaded;
        setImage((current) => (current ? { ...current, uploaded: stored } : current));
      }
      setImage((current) => (current ? { ...current, phase: "sending", error: null } : current));
      const caption = text.trim();
      const result = await onSendImage({
        imageId: uploaded.imageId,
        content: caption || undefined,
        clientRequestId: draft.clientRequestId,
      });
      if (result.ok) {
        setImage(null);
        setText("");
      } else {
        // Only when the server says the stored upload is unusable (expired, claimed) does the next attempt upload again; a network failure keeps it.
        // A null error is a person declining a question, not a failure.
        fail(result.error === null ? null : chatErrorMessage(result.error), isApiError(result.error) && result.error.is("INVALID_MESSAGE") ? { uploaded: null } : undefined);
      }
    } catch (error) {
      if (!abort.signal.aborted) fail(chatErrorMessage(error));
    } finally {
      imageInFlight.current = false;
      field.current?.focus();
    }
  };

  const submit = async () => {
    if (!canSend) return;
    if (image) {
      await submitImage(image);
      return;
    }
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

        {image && (
          <div className="flex items-center gap-3 border-b border-[var(--chat-line)] py-2.5 pr-2.5 pl-3 motion-safe:animate-chat-bar-in">
            <div className="relative h-14 w-14 flex-none overflow-hidden rounded-[10px] bg-white/[0.06]">
              {/* eslint-disable-next-line @next/next/no-img-element -- a local object URL of the chosen file; next/image cannot load it */}
              <img src={image.previewUrl} alt="Photo to send" className="h-full w-full object-cover" />
              {imageBusy && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/45">
                  <span aria-hidden className="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1 text-[13px] leading-[18px]">
              <p className="truncate font-semibold text-[var(--tt-text-secondary)]">{image.file.name}</p>
              {image.error ? (
                <p role="alert" className="text-[var(--tt-red)]">
                  {image.error}
                </p>
              ) : (
                <p role="status" className="text-[var(--chat-meta)]">
                  {image.phase === "uploading"
                    ? "Uploading…"
                    : image.phase === "sending"
                      ? "Sending…"
                      : `Add a caption, then send · up to ${MAX_IMAGE_MB} MB`}
                </p>
              )}
            </div>
            {image.error && !imageBusy && (
              <button
                type="button"
                onClick={() => void submit()}
                className="h-8 flex-none rounded-full bg-white/10 px-3 text-[13px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white/70"
              >
                Retry
              </button>
            )}
            <button
              type="button"
              onClick={removeImage}
              disabled={image.phase === "sending"}
              aria-label="Remove photo"
              className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-white/70 disabled:opacity-40"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        )}
        {pickError && !image && (
          <p role="alert" className="border-b border-[var(--chat-line)] px-4 py-2 text-[13px] text-[var(--tt-red)]">
            {pickError}
          </p>
        )}

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
            onPaste={(event) => {
              if (!photos) return;
              const pasted = firstImage(event.clipboardData.files);
              if (!pasted) return;
              event.preventDefault();
              chooseImage(pasted);
            }}
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
          {photos && (
            <>
              {/* Not display:none, and the button is a <label> for it: the browser itself opens the file
                  chooser on a press, with no script call that a browser could refuse. */}
              <input
                id={photoInputId}
                ref={fileInput}
                type="file"
                accept={IMAGE_ACCEPT}
                tabIndex={-1}
                aria-hidden="true"
                disabled={disabled || imageBusy}
                data-testid="photo-input"
                className="sr-only"
                onChange={(event) => {
                  const picked = firstImage(event.target.files);
                  event.target.value = "";
                  if (picked) chooseImage(picked);
                  else setPickError("Choose a JPEG, PNG, GIF or WebP photo.");
                }}
              />
              <label
                htmlFor={photoInputId}
                role="button"
                tabIndex={disabled || imageBusy ? -1 : 0}
                aria-disabled={disabled || imageBusy}
                aria-label="Add photo"
                title={`JPEG, PNG, GIF or WebP, up to ${MAX_IMAGE_MB} MB`}
                onKeyDown={(event) => {
                  if (event.key !== "Enter" && event.key !== " ") return;
                  event.preventDefault();
                  fileInput.current?.click();
                }}
                className={cn(
                  "flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full text-[var(--chat-meta)] transition-colors hover:bg-[var(--chat-active)] hover:text-[var(--tt-text)] focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-white/70",
                  (disabled || imageBusy) && "pointer-events-none cursor-not-allowed opacity-50",
                )}
              >
                <ImagePlus aria-hidden className="h-5 w-5" />
              </label>
            </>
          )}
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
            aria-busy={sending || imageBusy}
            className={cn(
              "flex h-9 w-9 flex-none items-center justify-center rounded-full text-white transition-[background-color,transform,opacity] duration-150 motion-reduce:transition-none",
              "bg-[var(--chat-own)] hover:bg-[var(--chat-own-pressed)] active:scale-95",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white",
              "disabled:cursor-default disabled:bg-white/10 disabled:text-white/35 disabled:active:scale-100",
            )}
          >
            {sending || imageBusy ? (
              <span aria-hidden className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white motion-reduce:animate-none" />
            ) : (
              <ArrowPostIcon className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
      {(image ? text.length > MAX_CAPTION_LENGTH - 100 : text.length >= COUNTER_FROM) && (
        <p
          className={cn(
            "mt-1.5 pr-3 text-right text-[12px] leading-4",
            text.length > (image ? MAX_CAPTION_LENGTH : MAX_MESSAGE_LENGTH) ? "text-[var(--tt-red)]" : "text-[var(--chat-meta)]",
          )}
        >
          {text.length}/{image ? MAX_CAPTION_LENGTH : MAX_MESSAGE_LENGTH}
        </p>
      )}
    </div>
  );
}
