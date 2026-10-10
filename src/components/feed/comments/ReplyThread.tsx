"use client";

import { Fragment, useState, type ReactNode } from "react";

import { REPLY_PAGE_SIZE, listReplies } from "@/lib/api/interactions";
import { toUiComments } from "@/lib/comment-cache";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/tiktok";

/**
 * `.DivReplyContainer` — flex column, gap 16px, **margin-left 52px**. Note the
 * indent is 52px from the comment row's left edge, i.e. 12px *past* where the
 * parent's own text starts (32px avatar + 8px gap = 40px), so replies do not
 * line up with the text above them.
 *
 * Collapsed:
 *   .DivViewMoreRepliesWrapper  flex row, gap 8px, margin-left -6px
 *   └ .DivViewRepliesContainer  flex row, gap 6px
 *     ├ button "View N replies" 14px / 500 / 18px, rgba(255,255,255,.6)
 *     └ chevron                 13×13, same colour
 *
 * Expanded, the wrapper becomes `justify-between`: "View N replies" keeps the
 * left slot and "Hide" takes the right, matching the live site's pagination.
 * Replies come down `REPLY_PAGE_SIZE` at a time, one request per click — a
 * comment with 30 replies costs nothing until somebody opens it.
 *
 * Each reply is drawn by `renderReply` — the parent's `CommentItem`, passed
 * in so this file does not have to import it back.
 */
export function ReplyThread({
  replies,
  replyCount,
  parentId,
  videoId,
  justAddedId,
  onRepliesLoaded,
  renderReply,
}: {
  /** The replies already loaded — fetched pages plus anything posted locally. */
  replies: Comment[];
  /** What the server says the thread holds, which is what the button counts down. */
  replyCount: number;
  parentId: string;
  videoId: string;
  justAddedId?: string | null;
  onRepliesLoaded?: (parentId: string, replies: Comment[]) => void;
  renderReply: (reply: Comment) => ReactNode;
}) {
  /** How many replies are on screen — 0 is the collapsed thread. */
  const [shownCount, setShownCount] = useState(0);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [loading, setLoading] = useState(false);

  // Posting a reply into a collapsed thread has to reveal it, or the comment
  // the user just wrote would appear to vanish. Adjusting state during render
  // (rather than in an effect) is React's sanctioned way to react to a changed
  // prop; `revealedFor` makes it fire once, so "Hide" still works afterwards.
  // A new reply is appended last, so revealing the whole thread is what shows it.
  if (
    justAddedId &&
    justAddedId !== revealedFor &&
    replies.some((reply) => reply.id === justAddedId)
  ) {
    setRevealedFor(justAddedId);
    setShownCount(replies.length);
  }

  const shown = replies.slice(0, shownCount);
  // `replies` can outrun the server's tally — a reply posted locally is on
  // screen before any listing counts it — so the larger of the two is the
  // thread's real length.
  const remaining = Math.max(0, Math.max(replyCount, replies.length) - shown.length);

  const showMore = async () => {
    const next = shownCount + REPLY_PAGE_SIZE;
    setShownCount(next);
    // Replies already in hand (posted locally, or a page fetched then hidden)
    // are revealed for free; only a click that runs past them goes back out.
    if (exhausted || loading || replies.length >= next) return;

    setLoading(true);
    try {
      const page = await listReplies(videoId, parentId, cursor ?? undefined);
      const entries = await toUiComments(page.items);
      onRepliesLoaded?.(parentId, entries.map((entry) => entry.ui));
      setCursor(page.nextCursor);
      setExhausted(!page.hasMore);
    } catch {
      // Leave the button where it is — clicking again retries.
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ml-[52px] flex flex-col gap-4">
      {shown.map((reply) => (
        <Fragment key={reply.id}>{renderReply(reply)}</Fragment>
      ))}

      <div className="-ml-1.5 flex flex-row items-center justify-between gap-2">
        {remaining > 0 ? (
          <div className="flex flex-row items-center gap-1.5">
            <span className="w-6 border-t border-white/40" />

            <button
              type="button"
              onClick={() => void showMore()}
              disabled={loading}
              aria-expanded={shownCount > 0}
              aria-busy={loading}
              className={cn(
                "flex flex-row items-center gap-1.5 py-px font-medium text-white/60 hover:opacity-80 transition-opacity duration-200 ease-in-out",
                shownCount > 0 ? "text-[14px] leading-[21px]" : "text-[14px] leading-[18px]",
              )}
            >
              {`View ${remaining} ${remaining === 1 ? "reply" : "replies"}`}
              <ChevronDownGlyph />
            </button>
          </div>
        ) : (
          // Keeps "Hide" in the right slot once every reply is shown.
          <span />
        )}

        {shownCount > 0 && (
          <button
            type="button"
            onClick={() => setShownCount(0)}
            className="flex flex-row items-center gap-1.5 py-px text-[14px] font-medium leading-[21px] text-white/60 hover:opacity-80 transition-opacity duration-200 ease-in-out"
          >
            Hide
            <ChevronUpGlyph />
          </button>
        )}
      </div>
    </div>
  );
}

/** The 13×13 chevron beside "View N replies" — path taken from the live SVG. */
function ChevronDownGlyph() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-[13px] w-[13px] flex-none text-white/60"
      fill="currentColor"
      aria-hidden
    >
      <path d="m24 27.76 13.17-13.17a1 1 0 0 1 1.42 0l2.82 2.82a1 1 0 0 1 0 1.42L25.06 35.18a1.5 1.5 0 0 1-2.12 0L6.59 18.83a1 1 0 0 1 0-1.42L9.4 14.6a1 1 0 0 1 1.42 0L24 27.76Z" />
    </svg>
  );
}

function ChevronUpGlyph() {
  return (
      <svg
          viewBox="0 0 48 48"
          className="h-[13px] w-[13px] flex-none text-white/60"
          fill="currentColor"
          aria-hidden
      >
        <path d="m24 20.24 13.17 13.17a1 1 0 0 0 1.42 0l2.82-2.82a1 1 0 0 0 0-1.42L25.06 12.82a1.5 1.5 0 0 0-2.12 0L6.59 29.17a1 1 0 0 0 0 1.42l2.81 2.81a1 1 0 0 0 1.42 0L24 20.24Z" />
      </svg>
  );
}
