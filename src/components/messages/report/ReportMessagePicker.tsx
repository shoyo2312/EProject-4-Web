"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

import { ChevronLeftIcon, CloseIcon } from "@/components/icons";
import { ImageMessage } from "@/components/messages/thread/ImageMessage";
import { StoryReplyMessage } from "@/components/messages/thread/StoryReplyMessage";
import { StickerMessage } from "@/components/messages/thread/StickerMessage";
import { VideoMessage } from "@/components/messages/thread/VideoMessage";
import { useReportMessages } from "@/hooks/use-report-messages";
import type { MessageResponse } from "@/lib/api/conversations";
import { REPORT_MAX_MESSAGES, type Selection } from "@/lib/chat-report";
import { cn } from "@/lib/utils";

const GAP_MS = 15 * 60 * 1000;

function stamp(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * The second step: the conversation again, each message a checkbox. It reads its own copy of the
 * history, so the thread behind (draft, scroll, socket) is untouched, and what is picked is kept by the
 * caller, so older pages arriving never move a tick. Clicks only pick: the video, sticker and quote
 * inside a row are inert.
 */
export function ReportMessagePicker({
  conversationId,
  me,
  reasonLabel,
  selected,
  limitReached,
  submitting,
  error,
  onToggle,
  onBack,
  onClose,
  onSubmit,
  reloadKey,
}: {
  conversationId: string;
  me: string;
  reasonLabel: string;
  selected: Selection;
  limitReached: boolean;
  submitting: boolean;
  error: string | null;
  onToggle: (id: string) => void;
  onBack: () => void;
  onClose: () => void;
  onSubmit: () => void;
  /** Bumped when a refusal means what the list shows may be stale. */
  reloadKey: number;
}) {
  const { messages, hasMore, loading, error: loadError, loadMore, reload } = useReportMessages(conversationId);
  const scroller = useRef<HTMLDivElement>(null);
  const height = useRef<number | null>(null);
  const placed = useRef(false);

  const seen = useRef(reloadKey);
  useLayoutEffect(() => {
    if (seen.current !== reloadKey) {
      seen.current = reloadKey;
      placed.current = false;
      reload();
    }
  }, [reloadKey, reload]);

  // Newest at the bottom on arrival; after older messages are put above, the reader keeps their place.
  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || messages.length === 0) return;
    if (!placed.current) {
      el.scrollTop = el.scrollHeight;
      placed.current = true;
    } else if (height.current !== null) {
      el.scrollTop += el.scrollHeight - height.current;
    }
    height.current = null;
  }, [messages]);

  const older = useCallback(() => {
    const el = scroller.current;
    if (el) height.current = el.scrollHeight;
    void loadMore().then((loaded) => {
      if (!loaded) height.current = null;
    });
  }, [loadMore]);

  const count = selected.size;
  return (
    <div className="flex h-full min-h-0 flex-col bg-black text-[var(--tt-text)]">
      <header className="flex h-[56px] flex-none items-center gap-3 border-b border-white/[0.12] px-4">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          aria-label="Back"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-50"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <h2 id="report-picker-title" className="min-w-0 flex-1 truncate text-[17px] leading-6 font-semibold">
          Report reason: {reasonLabel}
        </h2>
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          aria-label="Close"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-white/10 disabled:opacity-50"
        >
          <CloseIcon className="h-[14px] w-[14px]" />
        </button>
      </header>

      <div
        ref={scroller}
        onScroll={(event) => {
          if (hasMore && event.currentTarget.scrollTop < 80) older();
        }}
        className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain py-2"
      >
        {loading && (
          <p role="status" className="py-10 text-center text-[14px] text-[var(--chat-meta)]">
            Loading messages…
          </p>
        )}
        {loadError && (
          <div role="alert" className="py-10 text-center text-[14px] text-[var(--tt-red)]">
            {loadError}{" "}
            <button type="button" onClick={reload} className="underline">
              Retry
            </button>
          </div>
        )}
        {hasMore && !loading && (
          <button
            type="button"
            onClick={older}
            className="mx-auto mb-2 block rounded-full px-3 py-1 text-[13px] text-[var(--chat-meta)] hover:bg-white/10"
          >
            Load earlier messages
          </button>
        )}
        {messages.map((message, index) => {
          const previous = messages[index - 1];
          const showStamp = !previous || Date.parse(message.sentAt) - Date.parse(previous.sentAt) >= GAP_MS;
          return (
            <div key={message.id}>
              {showStamp && (
                <p className="my-3 text-center text-[12px] leading-4 font-semibold text-[var(--chat-meta)]">
                  {stamp(message.sentAt)}
                </p>
              )}
              <PickRow
                message={message}
                mine={message.senderId === me}
                checked={selected.has(message.id)}
                onToggle={() => onToggle(message.id)}
              />
            </div>
          );
        })}
      </div>

      <footer className="flex min-h-[64px] flex-none items-center gap-4 border-t border-white/[0.12] px-4">
        <div className="min-w-0 flex-1">
          <p aria-live="polite" className="text-[15px] leading-5 font-semibold">
            {count}/{REPORT_MAX_MESSAGES} {count === 1 ? "message" : "messages"} selected
          </p>
          {(limitReached || error) && (
            <p role="alert" className="text-[12.5px] leading-4 text-[var(--tt-red)]">
              {error ?? `You can select up to ${REPORT_MAX_MESSAGES} messages.`}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onSubmit}
          disabled={count === 0 || submitting}
          aria-busy={submitting}
          className="h-10 rounded-[4px] bg-[var(--tt-red-active)] px-5 text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red)] disabled:bg-white/[0.08] disabled:text-[var(--chat-meta)]"
        >
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </footer>
    </div>
  );
}

function PickRow({
  message,
  mine,
  checked,
  onToggle,
}: {
  message: MessageResponse;
  mine: boolean;
  checked: boolean;
  onToggle: () => void;
}) {
  const recalled = message.recalledAt !== null;
  const flip = () => {
    if (!recalled) onToggle();
  };
  return (
    <div
      role="checkbox"
      aria-checked={checked}
      aria-disabled={recalled || undefined}
      aria-label={`${mine ? "Your" : "Their"} message from ${stamp(message.sentAt)}`}
      tabIndex={0}
      onClick={flip}
      onKeyDown={(event) => {
        if (event.key === " " || event.key === "Enter") {
          event.preventDefault();
          event.stopPropagation();
          flip();
        }
      }}
      className={cn(
        "flex cursor-pointer items-center gap-8 px-4 py-2 outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-inset",
        checked && "bg-white/[0.08]",
        recalled && "cursor-default opacity-60",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "flex h-6 w-6 flex-none items-center justify-center rounded-[3px] border-2",
          checked ? "border-[var(--tt-red-active)] bg-[var(--tt-red-active)]" : "border-white/40",
          recalled && "border-white/20",
        )}
      >
        {checked && (
          <svg viewBox="0 0 12 12" className="h-3.5 w-3.5 text-white" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="m2 6.5 2.7 2.7L10 3.5" />
          </svg>
        )}
      </span>
      <div inert className={cn("flex min-w-0 flex-1 flex-col", mine ? "items-end" : "items-start")}>
        <Content message={message} mine={mine} />
      </div>
    </div>
  );
}

function Content({ message, mine }: { message: MessageResponse; mine: boolean }) {
  if (message.recalledAt) {
    return (
      <div className="rounded-[var(--chat-radius-bubble)] border border-[var(--chat-line)] px-3.5 py-2 text-[14px] leading-5 text-[var(--chat-meta)] italic">
        {mine ? "You recalled a message" : "Message recalled"} - can&apos;t be reported
      </div>
    );
  }
  if (message.type === "STICKER") return <StickerMessage sticker={message.sticker} />;
  if (message.type === "STORY_REPLY") {
    return (
      <StoryReplyMessage
        story={message.story}
        mine={mine}
        text={message.content}
        bubbleClassName={cn(
          "rounded-[var(--chat-radius-bubble)] px-3.5 py-2 text-[15px] leading-[1.6] break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
          mine ? "bg-[var(--chat-own)] text-white" : "bg-[var(--chat-recv)] text-[var(--tt-text)]",
        )}
      />
    );
  }
  if (message.type === "IMAGE") {
    return (
      <>
        <ImageMessage image={message.image} />
        {message.content && <Bubble mine={mine}>{message.content}</Bubble>}
      </>
    );
  }
  if (message.type === "VIDEO") {
    return (
      <>
        <VideoMessage video={message.video} mine={mine} />
        {message.content && <Bubble mine={mine}>{message.content}</Bubble>}
      </>
    );
  }
  return <Bubble mine={mine}>{message.content ?? ""}</Bubble>;
}

function Bubble({ mine, children }: { mine: boolean; children: React.ReactNode }) {
  return (
    <div
      className={cn(
        "rounded-[var(--chat-radius-bubble)] px-3.5 py-2 text-[15px] leading-[1.6] break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
        mine ? "bg-[var(--chat-own)] text-white" : "bg-[var(--chat-recv)] text-[var(--tt-text)]",
      )}
    >
      {children}
    </div>
  );
}
