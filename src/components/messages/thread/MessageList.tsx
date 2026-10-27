"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { JumpToLatest } from "@/components/messages/thread/JumpToLatest";
import { MessageActions } from "@/components/messages/thread/MessageActions";
import { ReactionBadges } from "@/components/messages/thread/ReactionBadges";
import { ReplyQuoteBlock } from "@/components/messages/thread/ReplyQuoteBlock";
import { StickerMessage } from "@/components/messages/thread/StickerMessage";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import type { MessageResponse } from "@/lib/api/conversations";
import { buildThread, formatMessageTime, myReaction } from "@/lib/chat";
import {
  STICK_PX,
  addUnseen,
  appendedAfter,
  isAtBottom,
  jumpButtonKind,
} from "@/lib/chat-scroll";
import { cn } from "@/lib/utils";

/** Scrolling this close to the top asks for the next older page. */
const LOAD_OLDER_PX = 160;

function scrollBehavior(): ScrollBehavior {
  const reduced =
    typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
  return reduced ? "auto" : "smooth";
}

/**
 * The history. It scrolls on its own and follows new messages only while the reader is at the
 * bottom (or sent the message themself); anyone reading further up keeps their place.
 *
 * A floating button over the bottom edge takes the reader back to the newest message. It is an
 * arrow while they are above it with nothing new, and the other person's avatar once a message
 * from them arrived while they were up there. "Arrived" is decided from the merged, de-duplicated
 * list — ids that appear after the previous newest one — so a frame delivered twice, an older page
 * prepended above, the first fetch and the reader's own messages never raise it. It clears only
 * when the bottom is really reached, whichever way: the button, the wheel, the keyboard.
 *
 * Older pages are prepended without moving what is on screen, even in the same update as a new
 * message. Resizing the panel keeps a reader at the bottom at the bottom and a reader above in place.
 */
export function MessageList({
  messages,
  me,
  hasMore,
  loadingOlder,
  onLoadOlder,
  onAtBottomChange,
  peerName,
  peerAvatar,
  onReact,
  onReply,
  onDelete,
}: {
  messages: MessageResponse[];
  me: string;
  hasMore: boolean;
  loadingOlder: boolean;
  onLoadOlder: () => void;
  /** Whether the newest message is really in view; "mark read" keys off it. */
  onAtBottomChange?: (atBottom: boolean) => void;
  /** The other person, for the jump button's avatar and its label. */
  peerName: string;
  peerAvatar: string | undefined;
  onReact: (message: MessageResponse, emoji: string) => void;
  onReply: (message: MessageResponse) => void;
  onDelete: (message: MessageResponse) => void;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  /** Within STICK_PX of the bottom at the last measure: new messages follow along. */
  const following = useRef(true);
  /** A button-driven smooth scroll is under way; any hand on the list cancels it. */
  const jumping = useRef(false);
  const previous = useRef({ first: "", last: "", firstTop: 0 });
  const reported = useRef<boolean | null>(null);

  const [atBottom, setAtBottom] = useState(true);
  const [unseen, setUnseen] = useState<string[]>([]);
  /** Where there is no hover, the message whose actions a tap opened. */
  const [tapped, setTapped] = useState<string | null>(null);
  const hoverCapable = useHoverCapable();

  const onAtBottomChangeRef = useRef(onAtBottomChange);
  useEffect(() => {
    onAtBottomChangeRef.current = onAtBottomChange;
  });

  const items = useMemo(() => buildThread(messages, me), [messages, me]);

  /**
   * The one place "where is the reader" is decided, so the ref the next update reads and the state
   * the button draws from cannot disagree — it runs after every scroll, resize and programmatic move.
   */
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const metrics = { scrollHeight: el.scrollHeight, scrollTop: el.scrollTop, clientHeight: el.clientHeight };
    const bottom = isAtBottom(metrics);
    following.current = isAtBottom(metrics, STICK_PX);
    setAtBottom(bottom);
    if (bottom) {
      jumping.current = false;
      setUnseen((current) => (current.length > 0 ? [] : current));
    }
    if (reported.current !== bottom) {
      reported.current = bottom;
      onAtBottomChangeRef.current?.(bottom);
    }
  }, []);

  const anchorTop = (el: HTMLElement, id: string) =>
    el.querySelector<HTMLElement>(`[data-id="${id}"]`)?.offsetTop ?? 0;

  useLayoutEffect(() => {
    const el = scroller.current;
    if (!el || messages.length === 0) return;
    const first = messages[0].id;
    const newest = messages[messages.length - 1];
    const before = previous.current;

    if (!before.last) {
      el.scrollTop = el.scrollHeight;
    } else {
      // Older history went in above: move by however far the old first message was pushed down,
      // so the reader keeps their place whatever else changed in the same update.
      if (first !== before.first && el.querySelector(`[data-id="${before.first}"]`)) {
        el.scrollTop += anchorTop(el, before.first) - before.firstTop;
      }
      const appended = appendedAfter(messages, before.last);
      if (appended.length > 0) {
        const mine = appended.some((message) => message.senderId === me);
        if (following.current || mine) {
          el.scrollTop = el.scrollHeight;
        } else {
          setUnseen((current) => addUnseen(current, appended, me));
          // A smooth scroll to the old bottom would stop short of this message: aim again.
          if (jumping.current) el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
        }
      }
    }
    previous.current = { first, last: newest.id, firstTop: anchorTop(el, first) };
    measure();
  }, [messages, me, measure]);

  useEffect(() => {
    const el = scroller.current;
    const inner = content.current;
    if (!el || !inner || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      // A reader at the bottom stays there when the panel, the composer or the text re-wraps.
      if (following.current) el.scrollTop = el.scrollHeight;
      measure();
    });
    observer.observe(el);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [measure]);

  const onScroll = () => {
    const el = scroller.current;
    if (!el) return;
    measure();
    if (hasMore && !loadingOlder && el.scrollTop < LOAD_OLDER_PX) onLoadOlder();
  };

  const stopJump = () => {
    jumping.current = false;
  };

  const jumpToLatest = () => {
    const el = scroller.current;
    if (!el) return;
    jumping.current = true;
    el.scrollTo({ top: el.scrollHeight, behavior: scrollBehavior() });
    // Deliberately nothing is cleared here: only arriving at the bottom (`measure`) clears it.
  };

  const kind = jumpButtonKind(atBottom, unseen.length);

  /** The original of a quote, when it is among the loaded messages; the page is not loaded back to it otherwise. */
  const jumpToMessage = (id: string) => {
    const target = scroller.current?.querySelector<HTMLElement>(`[data-id="${id}"]`);
    target?.scrollIntoView({ block: "center", behavior: scrollBehavior() });
  };

  return (
    <div className="relative min-h-0 flex-1">
      <div
        ref={scroller}
        onScroll={onScroll}
        onWheel={stopJump}
        onTouchStart={stopJump}
        onPointerDown={stopJump}
        onKeyDown={stopJump}
        tabIndex={0}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="h-full overflow-y-auto overscroll-contain px-4 py-3 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/30 tt-768:px-3"
      >
        <div ref={content}>
          {loadingOlder && (
            <p className="py-2 text-center text-[12px] text-[var(--tt-text-muted)]">Loading earlier messages…</p>
          )}

          {items.map((item) =>
            item.kind === "day" ? (
              <p
                key={item.key}
                className="my-3 text-center text-[12px] leading-4 font-medium text-[var(--tt-text-muted)]"
              >
                {item.label}
              </p>
            ) : (
              <div
                key={item.key}
                data-id={item.message.id}
                className={cn(
                  "flex flex-col",
                  item.mine ? "items-end" : "items-start",
                  item.startsRun ? "mt-2.5" : "mt-0.5",
                )}
              >
                {item.message.replyTo && (
                  <ReplyQuoteBlock
                    quote={item.message.replyTo}
                    mine={item.mine}
                    peerName={peerName}
                    onJump={jumpToMessage}
                  />
                )}
                <div
                  className="group/msg relative mt-0.5 max-w-[min(70%,480px)]"
                  onClick={hoverCapable ? undefined : () => setTapped((id) => (id === item.message.id ? null : item.message.id))}
                >
                  {item.message.recalledAt ? (
                    <div className="rounded-[18px] border border-dashed border-[var(--tt-divider)] px-3.5 py-2 text-[14px] leading-5 text-[var(--tt-text-muted)] italic">
                      {item.mine ? "You recalled a message" : "Message recalled"}
                    </div>
                  ) : item.message.type === "STICKER" ? (
                    <StickerMessage sticker={item.message.sticker} />
                  ) : (
                    <div
                      className={cn(
                        "rounded-[18px] px-3.5 py-2 text-[15px] leading-5 break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
                        item.mine
                          ? "bg-[var(--tt-red)] text-white"
                          : "bg-[var(--tt-field)] text-[var(--tt-text)]",
                        item.mine
                          ? [!item.startsRun && "rounded-tr-[5px]", !item.endsRun && "rounded-br-[5px]"]
                          : [!item.startsRun && "rounded-tl-[5px]", !item.endsRun && "rounded-bl-[5px]"],
                      )}
                    >
                      {item.message.content}
                    </div>
                  )}
                  <MessageActions
                    mine={item.mine}
                    pinned={tapped === item.message.id}
                    recalled={item.message.recalledAt !== null}
                    current={myReaction(item.message, me)}
                    onReact={(emoji) => onReact(item.message, emoji)}
                    onReply={() => onReply(item.message)}
                    onDelete={() => onDelete(item.message)}
                  />
                </div>
                <ReactionBadges
                  reactions={item.message.reactions}
                  me={me}
                  mine={item.mine}
                  onToggle={(emoji) => onReact(item.message, emoji)}
                />
                {item.endsRun && (
                  <time
                    dateTime={item.message.sentAt}
                    className="mt-1 px-1 text-[11px] leading-3 text-[var(--tt-text-muted)]"
                  >
                    {formatMessageTime(item.message.sentAt)}
                  </time>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      {kind !== "none" && <JumpToLatest kind={kind} name={peerName} avatar={peerAvatar} onClick={jumpToLatest} />}
    </div>
  );
}
