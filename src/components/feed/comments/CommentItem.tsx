"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Trash2 } from "lucide-react";

import { CommentText } from "@/components/feed/comments/CommentStates";
import { ReplyThread } from "@/components/feed/comments/ReplyThread";
import type { ReplyTarget } from "@/components/feed/comments/types";
import { HeartIcon, ReportIcon } from "@/components/icons";
import { ReportDialog } from "@/components/report/ReportDialog";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { useDismiss } from "@/hooks/use-dismiss";
import { likeComment, unlikeComment } from "@/lib/api/interactions";
import { COMMENT_REPORT_REASONS } from "@/lib/api/reports";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/tiktok";

/**
 * One comment. Structure re-measured against the live DOM — an earlier pass had
 * the like button as a third column of the row, which is wrong:
 *
 *   .DivCommentObjectWrapper            flex column, gap 16px, margin-bottom 24px
 *   └ .DivCommentItemWrapper            flex row, align-items center, gap **8px**
 *     ├ avatar                          32×32 (the circle is the inner span)
 *     └ .DivCommentContentWrapper       flex column, align-items flex-start,
 *                                       flex 1 1 auto, gap **6px**, break-word
 *       ├ .DivCommentHeaderWrapper      flex row, space-between
 *       │   ├ username                  (+ Creator pill)
 *       │   └ .DivMore                  14×21 "⋯"
 *       ├ comment text
 *       └ .DivCommentSubContentSplitWrapper  flex row, **space-between**
 *           ├ .DivCommentSubContentWrapper   flex, gap 12px — timestamp, Reply
 *           └ .DivLikeContainer              flex centre — 20px glyph + count
 *
 * The 21 + 6 + 23 + 6 + 21 stack is exactly the measured 77px row height.
 *
 * A reply reuses this whole structure with three deliberate differences,
 * measured on the live reply list rather than assumed:
 *   avatar        24×24 instead of 32×32
 *   header gap    3px instead of 6px
 *   "Reply" label 13px / 600 / 16.9px instead of 14px / 500 / 18.2px
 * Everything else — content gap 6px, sub-row gap 12px, the 20px like glyph, the
 * 14×21 "⋯" — is identical at both levels.
 *
 * Typography, measured on the elements that own the text nodes:
 *   username   13px / 500 / 16.9px  #f6f6f6
 *   body       15px / 478 / 22.5px  #f6f6f6   (TikTokFont is variable; 478 is
 *                                              not reachable with Inter, so
 *                                              this rounds to 500)
 *   timestamp  13px / 400 / 19.5px  rgba(255,255,255,.4)
 *   "Reply"    14px / 500 / 18.2px  rgba(255,255,255,.6)
 *   like glyph 20×20                 rgba(255,255,255,.6)
 *   like count 14px / 400 / 21px     rgba(255,255,255,.6)
 *
 */export function CommentItem({
  comment,
  videoId,
  isBackend,
  isReply = false,
  onReply,
  justAddedId,
  /** Thread this item belongs to — a reply's replies go to its parent. */
  parentId,
  currentUserId,
  canModerate = false,
  onDelete,
  onRepliesLoaded,
}: {
  comment: Comment;
  /** Backend video id — used to persist a like against this comment. */
  videoId: string;
  /** A real video persists likes through interaction-service; a mock one toggles locally. */
  isBackend: boolean;
  isReply?: boolean;
  onReply?: (target: ReplyTarget) => void;
  justAddedId?: string | null;
  parentId?: string;
  /** The signed-in viewer's id — only their own comments can be deleted. */
  currentUserId?: string;
  /** The video's uploader, viewing their own video — may delete anyone's comment on it. */
  canModerate?: boolean;
  onDelete?: (id: string) => void;
  /** Hands a fetched page of this comment's replies back to the panel's state. */
  onRepliesLoaded?: (parentId: string, replies: Comment[]) => void;
}) {
  const { user, openLogin } = useSession();
  const [liked, setLiked] = useState(comment.likedByMe ?? false);
  const [likeCount, setLikeCount] = useState(comment.likes);
  // Keyed on the value, not on every render: the optimistic bump and the POST
  // response both write local state without touching the prop, so this only
  // fires when the tally genuinely moved somewhere else — a realtime frame.
  useEffect(() => {
    setLikeCount(comment.likes);
  }, [comment.likes]);
  const [likePending, setLikePending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // A comment still waiting on its POST has no real id to like against yet.
  const canPersistLike = isBackend && /^\d+$/.test(comment.id);

  const toggleLike = async () => {
    if (isBackend && !user) {
      openLogin();
      return;
    }
    if (!canPersistLike) {
      // Mock video, or an optimistic row not yet saved — keep the old local-only toggle.
      setLiked((v) => !v);
      setLikeCount((n) => n + (liked ? -1 : 1));
      return;
    }
    if (likePending) return;
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => Math.max(0, n + (next ? 1 : -1)));
    setLikePending(true);
    try {
      const result = next
        ? await likeComment(videoId, comment.id)
        : await unlikeComment(videoId, comment.id);
      setLiked(result.liked);
      setLikeCount(result.likeCount);
    } catch {
      setLiked(!next);
      setLikeCount((n) => Math.max(0, n + (next ? -1 : 1)));
      toast.error("Couldn’t update your like. Please try again.");
    } finally {
      setLikePending(false);
    }
  };
  const avatarSize = isReply ? 24 : 32;
  // Mock authors carry no `userId`, so this is false for every mock comment —
  // the "⋯" stays decorative there, same as before this was wired up.
  const canDelete =
    Boolean(currentUserId) && (comment.author.userId === currentUserId || canModerate);
  // Reporting stands beside Delete rather than replacing it: an owner who
  // clears a comment off their video still wants it in front of a moderator,
  // and the comment's own author is the one who notices when their account has
  // been posting things they did not write. A mock comment, or an optimistic
  // row not yet saved, has no id admin-service could act on.
  const canReport = canPersistLike;
  const menuHasItems = canDelete || canReport;

  /* Click anywhere else — including the next comment's "⋯" — closes the menu. */
  useDismiss(menuRef, menuOpen, closeMenu);

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        !isReply && "mb-6",
        /* Off-screen comments skip layout and paint entirely — the cheap half
           of virtualising a long thread, with no library and no fixed row
           height. `contain-intrinsic-size: auto` remembers each row's real
           height once measured, so the scrollbar does not jump.

           Not while the "⋯" menu is open: `content-visibility` also applies
           paint containment, which would clip the popup where it overflows
           this row. */
        !isReply &&
          !menuOpen &&
          "[content-visibility:auto] [contain-intrinsic-size:auto_120px]",
        comment.id === justAddedId &&
          "animate-[tt-comment-in_320ms_ease-out] rounded-lg",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <Link
          href={`/@${comment.author.username}`}
          aria-label={comment.author.nickname}
          className={cn(
            "flex-none self-start",
            isReply ? "h-6 w-6" : "h-8 w-8",
          )}
        >
          <Image
            src={comment.author.avatarUrl}
            alt={comment.author.nickname}
            width={avatarSize}
            height={avatarSize}
            className={cn(
              "rounded-full object-cover",
              isReply ? "h-6 w-6" : "h-8 w-8",
            )}
          />
        </Link>

        <div className="flex flex-1 flex-col items-start gap-1.5 [overflow-wrap:break-word] [word-break:break-word]">
          {/* `.DivCommentHeaderWrapper` — username left, "⋯" right */}
          <div className="flex w-full items-center justify-between">
            <div className={cn("flex items-center", isReply ? "gap-[3px]" : "gap-1.5")}>
              <Link
                href={`/@${comment.author.username}`}
                className="text-[13px] font-medium leading-[16.9px] text-[var(--tt-icon)] hover:underline"
              >
                {comment.author.nickname}
              </Link>
              {comment.replyToName && (
                <>
                  <ReplyArrowGlyph />
                  <span className="max-w-[8rem] truncate text-[13px] font-medium leading-[16.9px] text-[var(--tt-text-secondary)]">
                    {comment.replyToName}
                  </span>
                </>
              )}
              {comment.isCreator && (
                <span className="rounded-[4px] bg-[var(--tt-field)] px-1 text-[11px] font-medium leading-4 text-[var(--tt-text-secondary)]">
                  Creator
                </span>
              )}
            </div>
            <div ref={menuRef} className="relative flex-none">
              <button
                type="button"
                onClick={menuHasItems ? () => setMenuOpen((open) => !open) : undefined}
                aria-label="More options"
                aria-haspopup={menuHasItems ? "menu" : undefined}
                aria-expanded={menuHasItems ? menuOpen : undefined}
                className="flex h-5 w-3.5 items-center justify-center text-white/60 hover:text-[var(--tt-text)]"
              >
                <MoreDotsGlyph />
              </button>

              {/* Report is offered to everyone the comment is actionable for;
                  Delete only to its author and the video's owner, and last, so
                  the destructive item is never the one under a stray click. */}
              {menuOpen && menuHasItems && (
                <div
                  role="menu"
                  className="absolute right-0 top-6 z-20 w-max animate-[tt-comment-in_150ms_ease-out] overflow-hidden rounded-[8px] border border-[var(--tt-divider)] bg-black shadow-lg"
                >
                  {canReport && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        if (!user) {
                          openLogin();
                          return;
                        }
                        setReportOpen(true);
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-[14px] font-medium text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10"
                    >
                      <ReportIcon className="h-4 w-4 flex-none" />
                      Report
                    </button>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete?.(comment.id);
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-[14px] font-medium text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10 hover:text-[var(--tt-red)]"
                    >
                      <Trash2 className="h-4 w-4 flex-none" strokeWidth={2} />
                      Delete
                    </button>
                  )}
                </div>
              )}

              {/* admin-service keys a COMMENT action by "videoId:commentId" —
                  see `CommentTarget`; the comment id alone reaches nothing,
                  Cassandra partitions comments by video. */}
              {reportOpen && (
                <ReportDialog
                  targetType="COMMENT"
                  targetId={`${videoId}:${comment.id}`}
                  reasons={COMMENT_REPORT_REASONS}
                  onClose={() => setReportOpen(false)}
                />
              )}
            </div>
          </div>

          <span className="text-[15px] font-medium leading-[22.5px] text-[var(--tt-icon)]">
            <CommentText text={comment.text} />
          </span>

          {/* `.DivCommentSubContentSplitWrapper` — space-between */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] leading-[19.5px] text-[var(--tt-placeholder)]">
                {comment.timestamp}
              </span>
              {/* Absent when the viewer may not comment — a reply is a comment. */}
              {onReply && (
                <button
                  type="button"
                  onClick={() =>
                    onReply({
                      parentId: parentId ?? comment.id,
                      username: comment.author.username,
                      replyToCommentId: comment.id,
                      replyToName: isReply ? comment.author.nickname : undefined,
                    })
                  }
                  className={cn(
                    "text-white/60 hover:underline",
                    isReply
                      ? "text-[13px] font-semibold leading-[16.9px]"
                      : "text-[14px] font-medium leading-[18.2px]",
                  )}
                >
                  Reply
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={toggleLike}
              aria-label={liked ? "Unlike comment" : "Like comment"}
              aria-pressed={liked}
              className="flex flex-none items-center justify-center gap-1"
            >
              <HeartIcon
                className={cn(
                  "h-5 w-5 transition-colors",
                  liked ? "text-[var(--tt-red)]" : "text-white/60",
                )}
              />
              <span className="text-[14px] leading-[21px] text-white/60">
                {formatCount(likeCount)}
              </span>
            </button>
          </div>
        </div>
      </div>

      {!isReply && (comment.replyCount ?? comment.replies?.length ?? 0) > 0 && (
        <ReplyThread
          replies={comment.replies ?? []}
          replyCount={comment.replyCount ?? comment.replies?.length ?? 0}
          parentId={comment.id}
          videoId={videoId}
          isBackend={isBackend}
          justAddedId={justAddedId}
          onRepliesLoaded={onRepliesLoaded}
          renderReply={(reply) => (
            <CommentItem
              comment={reply}
              videoId={videoId}
              isBackend={isBackend}
              isReply
              parentId={comment.id}
              onReply={onReply}
              justAddedId={justAddedId}
            />
          )}
        />
      )}
    </div>
  );
}

/** The "›" between a reply's author and the person it replies to. */
function ReplyArrowGlyph() {
  return (
    <svg
      viewBox="0 0 48 48"
      className="h-[11px] w-[11px] flex-none -rotate-90 text-[var(--tt-placeholder)]"
      fill="currentColor"
      aria-hidden
    >
      <path d="m24 27.76 13.17-13.17a1 1 0 0 1 1.42 0l2.82 2.82a1 1 0 0 1 0 1.42L25.06 35.18a1.5 1.5 0 0 1-2.12 0L6.59 18.83a1 1 0 0 1 0-1.42L9.4 14.6a1 1 0 0 1 1.42 0L24 27.76Z" />
    </svg>
  );
}

/** `.DivMore` — 14px glyph in the comment header's right slot. */
function MoreDotsGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-3.5 w-3.5" fill="currentColor">
      <circle cx="8" cy="24" r="4" />
      <circle cx="24" cy="24" r="4" />
      <circle cx="40" cy="24" r="4" />
    </svg>
  );
}
