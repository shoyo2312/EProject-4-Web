"use client";

import { CommentIcon } from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { splitMentions } from "@/lib/comments/mention";
import { cn } from "@/lib/utils";

/**
 * `.DivEmptyStateContainer` — what the panel shows before anyone has commented.
 *
 * Measured on the live site (a video with zero comments, right-hand panel):
 *   container  flex column, centred on both axes, gap 12, padding 24px 16px,
 *              filling the list area rather than sitting at its top
 *   art        109 × 80 line drawing; ours is the rail's own comment glyph at
 *              64px, dimmed to the same weight — a second illustration to keep
 *              in step buys nothing here
 *   label      14px / 20px, rgba(255,255,255,.75)
 */
export function NoCommentsYet() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-6">
      <CommentIcon className="h-16 w-16 text-white/25" />
      <p className="text-[14px] leading-5 text-white/75">
        Start the conversation
      </p>
    </div>
  );
}

/** Same shape as {@link NoCommentsYet}, shown when the creator turned comments off. */
export function CommentsOff() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-4 py-6">
      <CommentIcon className="h-16 w-16 text-white/25" />
      <p className="text-[14px] leading-5 text-white/75">
        This creator has turned off commenting
      </p>
    </div>
  );
}

/**
 * `count` is what the caller already knows is coming: video-service ships the
 * comment total with the video, long before interaction-service returns the
 * comments themselves. Capped by the caller at one page, since that is all the
 * first fetch can return; the default covers callers holding no count yet.
 *
 * Mirrors {@link CommentItem}'s live layout so the list does not jump when the
 * first page lands: 32 avatar, 8px row gap, 6px content gap, mb-6 between
 * rows, and the username / body / (timestamp · Reply · like) stack.
 */
export function CommentListSkeleton({ count = 5 }: { count?: number }) {
  return (
    <div className="flex flex-col">
      {Array.from({ length: count }).map((_, i) => {
        // Vary body width so stacked placeholders do not look like one stamp.
        const bodyWidth = i % 3 === 0 ? "w-[92%]" : i % 3 === 1 ? "w-[78%]" : "w-[85%]";
        return (
          <div key={i} className="mb-6 flex flex-col gap-2">
            <div className="flex flex-row items-center gap-2">
              <Skeleton className="h-8 w-8 shrink-0 self-start rounded-full" />
              <div className="flex flex-1 flex-col items-start gap-1.5">
                <div className="flex w-full items-center justify-between">
                  <Skeleton className="h-[17px] w-24" />
                  <Skeleton className="h-5 w-3.5" />
                </div>
                <Skeleton className={cn("h-[23px]", bodyWidth)} />
                <div className="flex w-full items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-5 w-8" />
                    <Skeleton className="h-[18px] w-10" />
                  </div>
                  <Skeleton className="h-5 w-10" />
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Comment body with its "@handle" runs tinted. Mentions are plain text here —
 * nothing resolves them to an account — so this is a render-time highlight, not
 * a link.
 */
export function CommentText({ text }: { text: string }) {
  return (
    <>
      {splitMentions(text).map((run, i) =>
        run.mention ? (
          <span key={i} className="text-[var(--tt-mention)]">
            {run.text}
          </span>
        ) : (
          run.text
        ),
      )}
    </>
  );
}
