"use client";

import { ArrowUp, Check } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { sendStoryReply } from "@/lib/api/conversations";
import { isApiError } from "@/lib/api/errors";
import { cn } from "@/lib/utils";

/** chat-service's `MessagePayload.MAX_STORY_REPLY`, counted in the same UTF-16 units as `maxLength`. */
export const MAX_STORY_REPLY = 1000;
/** Quick replies: added to the draft, not sent; sending is the button's. */
export const QUICK_EMOJIS = ["😍", "😂", "😳", "❤️", "👏", "🔥"] as const;

/** The reply typed here goes to the owner's direct messages; a reaction (ReactionBar) stays a reaction. */
export function StoryReplyBar({
  storyId,
  initialDraft,
  onDraftChange,
  onActiveChange,
  signedIn,
  onRequireLogin,
  onOpenChat,
}: {
  storyId: string;
  initialDraft: string;
  /** The draft belongs to this story: the parent keeps it by id, so it survives stepping away and back. */
  onDraftChange: (storyId: string, draft: string) => void;
  /** Typing, picking an emoji or sending: the story waits while this is true. */
  onActiveChange: (active: boolean) => void;
  signedIn: boolean;
  onRequireLogin: () => void;
  /** Opens the thread the reply went to. */
  onOpenChat: (conversationId: string) => void;
}) {
  const [draft, setDraft] = useState(initialDraft);
  const [focused, setFocused] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // One id per attempt at one text: a retry after a lost response is the same message, not a second.
  const attempt = useRef<{ text: string; id: string } | null>(null);

  // Coming back to a story with unsent text: the story waits for it again.
  useEffect(() => {
    if (initialDraft) onActiveChange(true);
  }, [initialDraft, onActiveChange]);

  const text = draft.trim();
  const active = focused || sending || draft.length > 0;
  const canSend = text.length > 0 && !sending;

  const setActive = (next: boolean) => onActiveChange(next);
  const change = (value: string) => {
    setDraft(value);
    setError(null);
    setSent(null);
    onDraftChange(storyId, value);
    setActive(focused || sending || value.length > 0);
  };

  const send = async () => {
    if (!canSend) return;
    if (!signedIn) {
      onRequireLogin();
      return;
    }
    if (attempt.current?.text !== text) attempt.current = { text, id: crypto.randomUUID() };
    setSending(true);
    setError(null);
    try {
      const message = await sendStoryReply({ storyId, content: text, clientRequestId: attempt.current.id });
      attempt.current = null;
      // Only this story's draft: the one the viewer may have moved to meanwhile is not touched.
      onDraftChange(storyId, "");
      setDraft("");
      setSent(message.conversationId);
      setSending(false);
      setActive(focused);
    } catch (failure) {
      setSending(false);
      setError(
        isApiError(failure) && failure.code === "STORY_NOT_AVAILABLE"
          ? "This story isn't available anymore"
          : isApiError(failure) && failure.status >= 400 && failure.status < 500 && failure.status !== 429
            ? failure.message
            : "Couldn't send. Try again",
      );
    }
  };

  return (
    <div
      className="pointer-events-auto flex w-full flex-col gap-2"
      // The bar is inside the media area, whose press means hold-to-pause and whose click means step.
      onPointerDown={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
    >
      <div
        role="group"
        aria-label="Quick replies"
        aria-hidden={!active}
        className={cn(
          "flex justify-center gap-3 transition-[opacity,transform] duration-200 ease-out motion-reduce:transition-none",
          active ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0",
        )}
      >
        {QUICK_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            tabIndex={active ? 0 : -1}
            aria-label={`Add ${emoji}`}
            // Keeps focus (and the caret) in the field instead of blurring it on press.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => change((draft + emoji).slice(0, MAX_STORY_REPLY))}
            className="h-9 w-9 rounded-full text-[24px] leading-9 transition-transform hover:scale-110 focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none"
          >
            {emoji}
          </button>
        ))}
      </div>

      <form
        className={cn(
          "flex h-12 items-center gap-2 rounded-full bg-white/[0.16] pr-1.5 pl-4 backdrop-blur-md transition-colors duration-200",
          focused && "bg-white/[0.22]",
        )}
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        <input
          ref={inputRef}
          type="text"
          name="story-reply"
          autoComplete="off"
          enterKeyHint="send"
          maxLength={MAX_STORY_REPLY}
          value={draft}
          disabled={sending}
          onChange={(event) => change(event.target.value)}
          onFocus={() => {
            if (!signedIn) {
              inputRef.current?.blur();
              onRequireLogin();
              return;
            }
            setFocused(true);
            setActive(true);
          }}
          onBlur={() => {
            setFocused(false);
            setActive(sending || draft.length > 0);
          }}
          onKeyDown={(event) => {
            // Enter that confirms an IME candidate is not a send.
            if (event.key === "Enter" && event.nativeEvent.isComposing) event.preventDefault();
            if (event.key === "Escape") {
              // First Escape leaves the field; the viewer keeps playing. A second one closes it.
              if (focused) {
                event.stopPropagation();
                inputRef.current?.blur();
              }
            }
          }}
          placeholder="Message…"
          aria-label="Reply to this story"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "story-reply-status" : undefined}
          className="min-w-0 flex-1 bg-transparent text-[15px] text-white caret-white outline-none placeholder:text-white/60"
        />
        <button
          type="submit"
          disabled={!canSend}
          aria-label={sending ? "Sending" : "Send reply"}
          className={cn(
            "flex h-9 w-9 flex-none items-center justify-center rounded-full bg-[var(--tt-red)] text-white transition-[opacity,transform,background-color] duration-200 hover:bg-[var(--tt-red-hover)] focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none",
            canSend || sending ? "scale-100 opacity-100" : "pointer-events-none scale-90 opacity-0",
            sending && "animate-pulse",
          )}
        >
          <ArrowUp className="h-[18px] w-[18px]" strokeWidth={2.5} />
        </button>
      </form>

      <p
        id="story-reply-status"
        role={error ? "alert" : "status"}
        className={cn("min-h-4 px-4 text-center text-[12.5px] leading-4", error ? "text-[#ff8a9b]" : "text-white/80")}
      >
        {error ??
          (sent ? (
            <span className="inline-flex items-center gap-1.5">
              <Check aria-hidden className="h-3.5 w-3.5" /> Sent
              <button
                type="button"
                onClick={() => onOpenChat(sent)}
                className="font-semibold underline underline-offset-2 focus-visible:outline-2 focus-visible:outline-white"
              >
                View chat
              </button>
            </span>
          ) : null)}
      </p>
    </div>
  );
}
