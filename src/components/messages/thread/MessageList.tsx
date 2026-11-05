"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { Check, CheckCheck } from "lucide-react";

import { JumpToLatest } from "@/components/messages/thread/JumpToLatest";
import { MessageActions } from "@/components/messages/thread/MessageActions";
import { ImageMessage } from "@/components/messages/thread/ImageMessage";
import { ReactionBadges } from "@/components/messages/thread/ReactionBadges";
import { ReplyQuoteBlock } from "@/components/messages/thread/ReplyQuoteBlock";
import { StickerMessage } from "@/components/messages/thread/StickerMessage";
import { StoryReplyMessage } from "@/components/messages/thread/StoryReplyMessage";
import { VideoMessage } from "@/components/messages/thread/VideoMessage";
import { useHoverCapable } from "@/hooks/use-hover-capable";
import { useSharedNow } from "@/hooks/use-shared-now";
import { useVisiblePeerMessage } from "@/hooks/use-visible-peer-message";
import type { MessageResponse, Receipt } from "@/lib/api/conversations";
import {
  STATUS_LABEL,
  buildThread,
  formatMessageTime,
  formatSeenAgo,
  myReaction,
  statusTargets,
  sharedVideoIds,
} from "@/lib/chat";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import {
  STICK_PX,
  addUnseen,
  appendedAfter,
  arrivedLive,
  isAtBottom,
  jumpButtonKind,
} from "@/lib/chat-scroll";
import { cn } from "@/lib/utils";

const NO_IDS: ReadonlySet<string> = new Set();

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
  receipt = null,
  liveIds,
  onVisibleNewestChange,
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
  /** How far the other side has got; "Delivered" and "Seen" under the viewer's newest message come from it. */
  receipt?: Receipt | null;
  /** Which messages arrived live; only those animate in. Without it nothing does. */
  liveIds?: ReadonlySet<string>;
  /**
   * The newest message of the other side that is on screen changed (null: none is). The caller decides
   * whether that makes it "seen" — this knows what is drawn and in view, not whether anyone is looking.
   */
  onVisibleNewestChange?: (messageId: string | null) => void;
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
  /** Messages that arrived while the thread was open: only these ease in, once; history and older pages do not. */
  const [arrived, setArrived] = useState<ReadonlySet<string>>(() => new Set());
  const hoverCapable = useHoverCapable();
  /** The scrollbar shows only while the reader is scrolling. */
  const [scrolling, setScrolling] = useState(false);
  const scrollTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(scrollTimer.current), []);

  const onAtBottomChangeRef = useRef(onAtBottomChange);
  useEffect(() => {
    onAtBottomChangeRef.current = onAtBottomChange;
  });

  const items = useMemo(() => buildThread(messages, me), [messages, me]);
  /** Which of the viewer's messages carry a state: the newest one seen, and the newest one if it is not that. */
  const targets = useMemo(() => statusTargets(messages, me, receipt), [messages, me, receipt]);
  useVisiblePeerMessage(scroller, messages, me, onVisibleNewestChange);

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
        const live = arrivedLive(appended, liveIds ?? NO_IDS);
        if (live.length > 0) setArrived((current) => new Set([...current, ...live.map((message) => message.id)]));
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
  }, [messages, me, measure, liveIds]);

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
    setScrolling(true);
    clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(() => setScrolling(false), 800);
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
        data-scrolling={scrolling}
        data-above={!atBottom}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="h-full overflow-y-auto overscroll-contain px-3 pt-3 pb-1 [scrollbar-color:transparent_transparent] data-[above=true]:[mask-image:linear-gradient(to_bottom,#000_calc(100%-24px),transparent)] data-[scrolling=true]:[scrollbar-color:rgb(255_255_255/0.3)_transparent] focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-white/30 "
      >
        <div ref={content}>
          {loadingOlder && (
            <p className="py-2 text-center text-[12px] text-[var(--chat-meta)]">Loading earlier messages…</p>
          )}

          {items.map((item) =>
            item.kind === "day" ? (
              <p key={item.key} className="my-5 flex justify-center first:mt-1">
                <span className="rounded-full bg-white/[0.06] px-3 py-1 text-[11.5px] leading-4 font-medium text-[var(--chat-meta)]">
                  {item.label}
                </span>
              </p>
            ) : (
              <div
                key={item.key}
                data-id={item.message.id}
                className={cn(
                  "flex flex-col",
                  arrived.has(item.message.id) &&
                    (item.mine ? "origin-bottom-right" : "origin-bottom-left") + " motion-safe:animate-chat-in",
                  item.mine ? "items-end" : "items-start",
                  item.startsRun ? "mt-3" : "mt-0.5",
                )}
              >
                {item.message.replyTo && (
                  <ReplyQuoteBlock
                    quote={item.message.replyTo}
                    mine={item.mine}
                    peerName={peerName}
                    onJump={jumpToMessage}
                    animate={arrived.has(item.message.id)}
                  />
                )}
                <div
                  className="group/msg relative z-[1] mt-0.5 max-w-[min(78%,560px)]"
                  onClick={hoverCapable ? undefined : () => setTapped((id) => (id === item.message.id ? null : item.message.id))}
                >
                  {item.message.recalledAt ? (
                    <div className="rounded-[var(--chat-radius-bubble)] border border-[var(--chat-line)] px-3.5 py-2 text-[14px] leading-5 text-[var(--chat-meta)] italic">
                      {item.mine ? "You recalled a message" : "Message recalled"}
                    </div>
                  ) : item.message.type === "STICKER" ? (
                    <StickerMessage sticker={item.message.sticker} />
                  ) : item.message.type === "STORY_REPLY" ? (
                    <StoryReplyMessage
                      story={item.message.story}
                      mine={item.mine}
                      text={item.message.content}
                      bubbleClassName={bubble(item.mine, true, true)}
                    />
                  ) : item.message.type === "IMAGE" ? (
                    <div className={cn("flex flex-col gap-1", item.mine ? "items-end" : "items-start")}>
                      <ImageMessage image={item.message.image} />
                      {item.message.content && (
                        <div className={bubble(item.mine, true, true)}>{item.message.content}</div>
                      )}
                    </div>
                  ) : item.message.type === "VIDEO" ? (
                    <div className={cn("flex flex-col gap-1", item.mine ? "items-end" : "items-start")}>
                      <VideoMessage
                        video={item.message.video}
                        mine={item.mine}
                        onOpen={() => markOverlayOrigin(window.location.pathname + window.location.search, sharedVideoIds(messages))}
                      />
                      {item.message.content && (
                        <div className={bubble(item.mine, true, true)}>{item.message.content}</div>
                      )}
                    </div>
                  ) : (
                    <div className={bubble(item.mine, item.startsRun, item.endsRun)}>{item.message.content}</div>
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
                <MessageMeta
                  mine={item.mine}
                  sentAt={item.endsRun ? item.message.sentAt : null}
                  status={
                    item.mine && item.message.id === targets.seenId
                      ? "SEEN"
                      : item.mine && item.message.id === targets.latestId
                        ? targets.latestStatus
                        : null
                  }
                  readAt={receipt?.read?.at}
                />
              </div>
            ),
          )}
        </div>
      </div>

      {kind !== "none" && <JumpToLatest kind={kind} name={peerName} avatar={peerAvatar} onClick={jumpToLatest} />}
    </div>
  );
}

/** Yours: the brand red; theirs: the receive surface. Inside a run the corner on the sender's side tightens. */
function bubble(mine: boolean, startsRun: boolean, endsRun: boolean): string {
  return cn(
    "rounded-[var(--chat-radius-bubble)] px-3.5 py-2 text-[15px] leading-[1.6] break-words whitespace-pre-wrap [overflow-wrap:anywhere]",
    mine
      ? [
          "bg-[var(--chat-own)] text-white transition-colors duration-150 group-hover/msg:bg-[var(--chat-own-pressed)]",
          !startsRun && "rounded-tr-[var(--chat-radius-tight)]",
          !endsRun && "rounded-br-[var(--chat-radius-tight)]",
        ]
      : [
          "bg-[var(--chat-recv)] text-[var(--tt-text)]",
          !startsRun && "rounded-tl-[var(--chat-radius-tight)]",
          !endsRun && "rounded-bl-[var(--chat-radius-tight)]",
        ],
  );
}

const STATUS_ICON = { SENT: Check, DELIVERED: CheckCheck, SEEN: CheckCheck } as const;

/**
 * The quiet line under a message: its time when it closes a run, and — on the viewer's own — where the
 * other side has got to. One row for both, so a run does not grow two lines of small print; `data-status`
 * is what tests and styles key on.
 */
function MessageMeta({
  mine,
  sentAt,
  status,
  readAt,
}: {
  mine: boolean;
  sentAt: string | null;
  status: "SENT" | "DELIVERED" | "SEEN" | null;
  readAt: string | null | undefined;
}) {
  if (!sentAt && !status) return null;
  const Icon = status ? STATUS_ICON[status] : null;
  return (
    <div className={cn("mt-1 flex items-center gap-1.5 px-1 text-[11.5px] leading-4 text-[var(--chat-meta)]", mine ? "justify-end" : "justify-start")}>
      {sentAt && <time dateTime={sentAt}>{formatMessageTime(sentAt)}</time>}
      {sentAt && status && <span aria-hidden>·</span>}
      {status && Icon && (
        <span data-status={status} className={cn("inline-flex items-center gap-1 font-medium", status === "SEEN" && "text-[var(--tt-text-secondary)]")}>
          <Icon aria-hidden className="h-3 w-3" strokeWidth={2.4} />
          {status === "SEEN" ? <SeenAgo at={readAt} /> : STATUS_LABEL[status]}
        </span>
      )}
    </div>
  );
}

/**
 * "Seen just now" / "Seen 13 min ago", counted from when the server recorded the read. Only this small
 * component follows the shared clock, so a tick re-renders one label and not the whole list, and the
 * clock runs only while a seen label is on screen.
 */
function SeenAgo({ at }: { at: string | null | undefined }) {
  return <>{formatSeenAgo(at, useSharedNow())}</>;
}
