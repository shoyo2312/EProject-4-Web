"use client";

import { useEffect, useRef, useState } from "react";

import { CommentComposer } from "@/components/feed/comments/CommentComposer";
import { CommentItem } from "@/components/feed/comments/CommentItem";
import {
  CommentListSkeleton,
  CommentLockNotice,
  CommentsLocked,
  NoCommentsYet,
} from "@/components/feed/comments/CommentStates";
import type { ReplyTarget } from "@/components/feed/comments/types";
import { useCommentThread } from "@/components/feed/comments/use-comment-thread";
import { CloseIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { useCommentRestriction } from "@/hooks/use-comment-restriction";
import {
  COMMENT_FIRST_PAGE_SIZE,
  addComment,
  deleteComment as deleteCommentApi,
} from "@/lib/api/interactions";
import { invalidateCommentPage } from "@/lib/comment-cache";
import { commentLockMessage } from "@/lib/comments/restriction";
import {
  addReply,
  hasCommentId,
  remapCommentId,
  removeCommentById,
} from "@/lib/comments/tree";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Comment } from "@/types/tiktok";

/**
 * `.SectionCommentSidebarContainer`, wrapped by
 * `.DivCommentSidebarTransitionWrapper`. Both were read from the live site's
 * emotion rule text:
 *
 *   wrapper   flex-grow: 1; overflow: hidden; z-index: 8; height: 100%;
 *             transition-duration: 300ms; transition-timing-function: linear;
 *             transition-property: flex, width           (NOT the article's
 *                                                         cubic-bezier)
 *             enter/exit  width 0 → 24rem → 0
 *             @media (max-width: 1280px) 21rem
 *             @media (max-width: 1024px) 18rem
 *   panel     display: flex; flex-direction: column;
 *             min-width: 18rem; max-width: 24rem;
 *             padding: 16px 16px 20px; z-index: 10;
 *             position: sticky; top: 0; height: 100%;
 *             max-height: calc(0px + 100vh);
 *             background: var(--ui-page-flat-1);
 *             box-shadow: rgba(255,255,255,.12) -1px 0 1px;
 *
 * Note the wrapper eases **linear** while the article it displaces eases
 * `cubic-bezier(0.25, 0, 0.25, 1)` — the two are deliberately different on the
 * live site, so they are kept different here.
 */
export function CommentPanel({
  videoId,
  videoOwnerId,
  commentCount,
  commentsDisabled = false,
  onClose,
  onCommentAdded,
  onCommentDeleted,
  variant = "sidebar",
}: {
  videoId: string;
  /**
   * The video's uploader — interaction-service lets them delete any comment on their own video,
   * not only their own, so the "⋯" menu offers Delete there too.
   */
  videoOwnerId?: string;
  /** Total shown in the header — the loaded count plus anything posted here. */
  commentCount: number;
  /**
   * The owner turned comments off. The panel then reads no comments, shows no
   * count, and replaces the composer with a notice — matching the backend,
   * which returns an empty list and refuses new comments.
   */
  commentsDisabled?: boolean;
  onClose: () => void;
  onCommentAdded: () => void;
  /** Fired after a comment is removed, so the caller's count stays in sync. */
  onCommentDeleted: () => void;
  /**
   * `sidebar` is the feed's collapsible panel, sized and shadowed as above.
   * `detail` is the lower half of `/video/[id]`'s right column — wider than
   * the feed sidebar, and the page (not this panel) owns the collapse chrome.
   */
  variant?: "sidebar" | "detail";
}) {
  const isDetail = variant === "detail";
  const { user } = useSession();
  // The video carries both switches — its own and an account open to no one.
  // Friends-only depends on who is asking, so it is asked for; the owner is
  // exempt from it, so is not asked.
  const restriction = useCommentRestriction(
    videoId,
    !commentsDisabled && user?.userId !== videoOwnerId
      ? (user?.userId ?? null)
      : null,
  );
  /** Set when the viewer may read this thread but not add to it. */
  const lockMessage = commentLockMessage(commentsDisabled, restriction);
  const { comments, setComments, loading, hasMore, loadingMore, loadMore, appendReplies } =
    useCommentThread({
      videoId,
      commentsDisabled,
      realtime: user !== null,
    });
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  /** Newest locally-posted comment — drives the slide-in and the auto-expand. */
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const composerRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Scrolled into view at the foot of the list — fetches the next page. */
  const sentinelRef = useRef<HTMLButtonElement>(null);

  /**
   * Infinite scroll. The sentinel *is* the "Load more" button rather than an
   * empty div: the observer covers the mouse, and the button still answers a
   * keyboard or a retry after a failed fetch. Root is the scrolling list, with
   * a screen of lead time so the next page lands before the viewer arrives.
   */
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMore();
      },
      { root: listRef.current, rootMargin: "200px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, loadMore]);

  const startReply = (target: ReplyTarget) => {
    setReplyTo(target);
    composerRef.current?.focus();
  };

  const postBackendComment = async (text: string, target: ReplyTarget | null) => {
    if (!user) return;
    invalidateCommentPage(videoId);
    const optimistic: Comment = {
      id: `pending-${Date.now()}`,
      author: user,
      text,
      timestamp: "now",
      likes: 0,
      replyToName: target?.replyToName,
    };
    setComments((current) =>
      target ? addReply(current, target.parentId, optimistic) : [optimistic, ...current],
    );
    setJustAddedId(optimistic.id);
    if (!target) listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    onCommentAdded();

    try {
      const saved = await addComment(
        videoId,
        text,
        target?.replyToCommentId ?? target?.parentId,
      );
      setComments((current) =>
        // The realtime frame for this same comment can land before this HTTP
        // response does — it is a broadcast to every device, including this
        // one, and nothing about it waits for this request to finish. When
        // that happens `saved.commentId` is already in the list (inserted by
        // `useCommentThread`'s `applyRealtimeFrame`), so remapping would leave
        // two rows with the same id; drop the placeholder and keep the one
        // already there instead.
        hasCommentId(current, saved.commentId)
          ? removeCommentById(current, optimistic.id)
          : remapCommentId(current, optimistic.id, saved.commentId),
      );
    } catch {
      // Roll back both the optimistic row and the count bump, and say so —
      // unlike a like, a lost comment leaves no visible trace to explain it.
      setComments((current) => removeCommentById(current, optimistic.id));
      onCommentDeleted();
      toast.error("Couldn’t post your comment. Please try again.");
    }
  };

  const post = (text: string) => {
    void postBackendComment(text, replyTo);
    setReplyTo(null);
  };

  const deleteOwnComment = async (id: string) => {
    invalidateCommentPage(videoId);
    const previous = comments;
    setComments((current) => removeCommentById(current, id));
    onCommentDeleted();
    try {
      await deleteCommentApi(videoId, id);
      toast.success("Comment deleted.");
    } catch {
      setComments(previous);
      onCommentAdded();
      toast.error("Couldn’t delete the comment. Please try again.");
    }
  };

  return (
    <section
      className={cn(
        "sticky top-0 z-10 flex h-full max-h-screen flex-col",
        "px-4 pb-5 pt-4",
        isDetail
          ? "w-full min-w-0"
          : "min-w-64 max-w-96 bg-[var(--tt-page)] shadow-[-1px_0_1px_var(--tt-divider)]",
      )}
    >
      {/* `.DivCommentHeader` — flex, space-between, padding-bottom 16px. */}
      <header className="relative flex flex-none items-center justify-between pb-4">
        {/* Count reads "<n> comments", centred over the row. */}
        <div className="flex flex-1 items-center justify-center gap-1">
          {!commentsDisabled && (
            <span className="text-[14px] font-bold text-[var(--tt-text)]">
              {formatCount(commentCount)}
            </span>
          )}
          <span className="text-[14px] font-bold text-[var(--tt-text)]">
            comments
          </span>
        </div>
        {/* Detail collapses from the tab row above this panel; the feed sidebar
            owns its own close control here. */}
        {!isDetail && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors duration-200 bg-[var(--tt-field)] hover:bg-[var(--tt-shape-neutral-3)]"
          >
            <CloseIcon className="h-[16px] w-[16px]" />
          </button>
        )}
      </header>

      {/* `.DivCommentMain` — flex-grow 1, overflow-y scroll, scrollbar-width none */}
      <div
        ref={listRef}
        className="no-scrollbar flex-1 overflow-y-scroll [overscroll-behavior:contain]"
      >
        {/* A video whose count is 0 has nothing to wait for: skip the skeleton
            and show the empty state at once, rather than flashing placeholder
            rows that resolve to nothing. */}
        {comments.length === 0 &&
          (loading && commentCount > 0 && !commentsDisabled ? (
            <CommentListSkeleton
              count={Math.min(commentCount, COMMENT_FIRST_PAGE_SIZE)}
            />
          ) : lockMessage ? (
            <CommentsLocked message={lockMessage} />
          ) : (
            <NoCommentsYet />
          ))}

        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            videoId={videoId}
            onReply={lockMessage ? undefined : startReply}
            justAddedId={justAddedId}
            currentUserId={user?.userId}
            canModerate={Boolean(user) && user?.userId === videoOwnerId}
            onDelete={deleteOwnComment}
            onRepliesLoaded={appendReplies}
          />
        ))}

        {hasMore && (
          <button
            ref={sentinelRef}
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="w-full py-2 text-center text-[14px] font-medium text-white/60 hover:underline disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : "Load more comments"}
          </button>
        )}
      </div>

      {/* An empty locked thread already says why in the middle of the list. */}
      {!lockMessage ? (
        <CommentComposer
          ref={composerRef}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPost={post}
        />
      ) : (
        comments.length > 0 && <CommentLockNotice message={lockMessage} />
      )}
    </section>
  );
}
