"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { ChevronDown } from "lucide-react";

import { CommentText } from "@/components/feed/comments/CommentStates";
import { toast } from "@/components/ui/toast";
import { isApiError, messageFor } from "@/lib/api/errors";
import { approveComment, deleteComment, listHeldComments } from "@/lib/api/interactions";
import { type CommentEntry, toUiComments } from "@/lib/comment-cache";
import { cn } from "@/lib/utils";

/**
 * The video owner's review queue, above the thread: comments the text rules
 * held — a link, a phone number, milder profanity — until the owner approves or
 * deletes them. Only the owner sees them, and nothing announces a new one, so
 * the queue is read once each time the panel opens.
 *
 * Approving counts the comment here (`onApproved`); the thread itself gets the
 * row from the realtime frame the approval publishes, like any new comment.
 *
 * ponytail: a queue emptied by hand while more pages wait behind it hides until
 * the next open. Fetch the next page on empty if owners clear queues that long.
 */
export function HeldComments({
  videoId,
  onApproved,
}: {
  videoId: string;
  onApproved: () => void;
}) {
  const [held, setHeld] = useState<CommentEntry[]>([]);
  /** Where the next page starts; null once the queue is read to its end. */
  const [cursor, setCursor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Comments with an approve or delete in flight — a second tap would count twice. */
  const [busy, setBusy] = useState<ReadonlySet<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    listHeldComments(videoId)
      .then(async (page) => {
        const entries = await toUiComments(page.items);
        if (cancelled) return;
        setHeld(entries);
        setCursor(page.hasMore ? page.nextCursor : null);
      })
      .catch(() => {
        // No queue to show: a blip, or ownership the server could not confirm.
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await listHeldComments(videoId, cursor);
      const entries = await toUiComments(page.items);
      setHeld((current) => [...current, ...entries]);
      setCursor(page.hasMore ? page.nextCursor : null);
    } catch {
      // Stay put — the button is still there to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const review = async (id: string, approve: boolean) => {
    setBusy((current) => new Set(current).add(id));
    try {
      if (approve) await approveComment(videoId, id);
      else await deleteComment(videoId, id);
      setHeld((current) => current.filter((entry) => entry.ui.id !== id));
      if (approve) onApproved();
      toast.success(approve ? "Comment approved." : "Comment deleted.");
    } catch (cause) {
      // Already gone — its author deleted it, the thread it answered went, or a
      // block now stands between it and the comment it answers.
      const gone = isApiError(cause) && cause.is("COMMENT_NOT_FOUND");
      if (gone) setHeld((current) => current.filter((entry) => entry.ui.id !== id));
      toast.error(
        gone
          ? messageFor(cause)
          : `Couldn’t ${approve ? "approve" : "delete"} the comment. Please try again.`,
      );
    } finally {
      setBusy((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  if (held.length === 0) return null;

  const count = `${held.length}${cursor ? "+" : ""}`;
  return (
    <div className="mb-6">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between gap-2 rounded-[8px] bg-[var(--tt-field)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
      >
        <span className="text-[14px] font-semibold leading-5 text-[var(--tt-text)]">
          {count} {count === "1" ? "comment" : "comments"} held for review
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 flex-none text-[var(--tt-icon)] transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      {open && (
        <div className="mt-3 flex animate-[tt-comment-in_200ms_ease-out] flex-col gap-4">
          <p className="text-[13px] leading-[18px] text-[var(--tt-text-secondary)]">
            Only you can see these until you approve them. They may contain spam or
            offensive language.
          </p>
          <ul className="flex flex-col gap-4">
            {held.map(({ ui }) => (
              <li key={ui.id} className="flex gap-2">
                <Image
                  src={ui.author.avatarUrl}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-none rounded-full object-cover"
                />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1.5 [overflow-wrap:break-word] [word-break:break-word]">
                  <span className="text-[13px] font-medium leading-[16.9px] text-[var(--tt-icon)]">
                    {ui.author.nickname}
                  </span>
                  <span className="text-[15px] font-medium leading-[22.5px] text-[var(--tt-icon)]">
                    <CommentText text={ui.text} />
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="mr-1 text-[13px] leading-[19.5px] text-[var(--tt-placeholder)]">
                      {ui.timestamp}
                    </span>
                    <button
                      type="button"
                      onClick={() => void review(ui.id, true)}
                      disabled={busy.has(ui.id)}
                      aria-label={`Approve comment by ${ui.author.nickname}`}
                      className="h-7 rounded-full bg-[var(--tt-red)] px-3 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void review(ui.id, false)}
                      disabled={busy.has(ui.id)}
                      aria-label={`Delete comment by ${ui.author.nickname}`}
                      className="h-7 rounded-full bg-[var(--tt-field)] px-3 text-[13px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-shape-neutral-3)] disabled:opacity-40"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {cursor && (
            <button
              type="button"
              onClick={() => void loadMore()}
              disabled={loadingMore}
              className="w-full py-1 text-center text-[14px] font-medium text-white/60 hover:underline disabled:opacity-40"
            >
              {loadingMore ? "Loading…" : "Show more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
