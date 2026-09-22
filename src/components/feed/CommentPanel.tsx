"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CommentComposer } from "@/components/feed/comments/CommentComposer";
import { CommentItem } from "@/components/feed/comments/CommentItem";
import {
  CommentListSkeleton,
  CommentsOff,
  NoCommentsYet,
} from "@/components/feed/comments/CommentStates";
import type {
  CommentRealtimeFrame,
  ReplyTarget,
} from "@/components/feed/comments/types";
import { CloseIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import { useCommentRealtime } from "@/hooks/use-comment-realtime";
import { isBackendHandle } from "@/lib/api/adapters";
import { getAccessToken } from "@/lib/api/tokens";
import { resolveAuthor } from "@/lib/api/authors";
import {
  COMMENT_FIRST_PAGE_SIZE,
  addComment,
  deleteComment as deleteCommentApi,
  listComments,
} from "@/lib/api/interactions";
import {
  type CommentPage,
  invalidateCommentPage,
  loadFirstCommentPage,
  peekCommentPage,
  toUiComments,
} from "@/lib/comment-cache";
import {
  type PendingReply,
  addReply,
  hasCommentId,
  mergeComments,
  remapCommentId,
  removeCommentById,
  setCommentLikes,
} from "@/lib/comments/tree";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-feed";
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
  comments: initialComments,
  commentCount,
  commentsDisabled = false,
  onClose,
  onCommentAdded,
  onCommentDeleted,
  variant = "sidebar",
}: {
  /** Backend id (numeric) fetches real comments; a mock id keeps `comments` as-is. */
  videoId: string;
  /**
   * The video's uploader — interaction-service lets them delete any comment on their own video,
   * not only their own, so the "⋯" menu offers Delete there too. Absent for mock videos, whose
   * comments carry no `userId` to match against anyway.
   */
  videoOwnerId?: string;
  /** This video's comments as loaded by the page — used only for mock ids. */
  comments: Comment[];
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
  const isBackend = isBackendHandle(videoId);
  const { user } = useSession();
  // Same pattern as `Feed.tsx`'s `wsToken`: read during render so a token
  // change (login, or a rotation that happens to land on a re-render) is a
  // dependency `useCommentRealtime` can react to — reading it
  // only inside that effect would close over whatever `getStompClient` built
  // at mount and never notice a later swap.
  const token = user ? getAccessToken() : null;
  /**
   * The panel is keyed by video id, so every pass over a video in the feed
   * remounts it. Seeding from the cache — synchronously, during the first
   * render — is what makes a revisit paint its comments instead of a skeleton.
   */
  const cached: CommentPage | undefined = isBackend
    ? peekCommentPage(videoId)
    : undefined;
  const [comments, setComments] = useState<Comment[]>(() =>
    cached ? mergeComments([], cached.entries, []) : isBackend ? [] : initialComments,
  );
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  /** Newest locally-posted comment — drives the slide-in and the auto-expand. */
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isBackend && !cached);
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  /** Scrolled into view at the foot of the list — fetches the next page. */
  const sentinelRef = useRef<HTMLButtonElement>(null);
  /** Replies whose parent lands on a later page — held across `loadMore` calls until it arrives. */
  const pendingRepliesRef = useRef<PendingReply[]>([]);

  // Real comments load once per video; the mock path keeps the prop as its
  // whole state, unchanged from before this was wired up.
  useEffect(() => {
    // Comments off: the backend returns an empty list, so there is nothing to fetch.
    if (!isBackend || commentsDisabled) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    // The cached page seeds the paint; opening the panel always refetches.
    // The cache lives for the whole tab and only drops on a mutation this tab
    // saw, so a video whose comments were read while it had none — then opened
    // again from a notification about a comment somebody else just left —
    // otherwise kept painting the empty list until a full reload, under a
    // header count that came fresh from video-service and said 1.
    setLoading(!peekCommentPage(videoId));
    pendingRepliesRef.current = [];

    loadFirstCommentPage(videoId, true)
      .then((page) => {
        if (cancelled) return;
        setComments(mergeComments([], page.entries, pendingRepliesRef.current));
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      })
      .catch(() => {
        // Leave the list empty — the header count still comes from video-service.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [videoId, isBackend, commentsDisabled]);

  /**
   * Folds one realtime frame into the list. Whatever the frame says, this
   * video's cached first page is now stale.
   */
  const applyRealtimeFrame = useCallback(
    (frame: CommentRealtimeFrame) => {
      invalidateCommentPage(videoId);
      if (frame.type === "comment.liked") {
        if (frame.likeCount === undefined) return;
        setComments((current) =>
          setCommentLikes(current, frame.commentId, frame.likeCount as number),
        );
        return;
      }
      if (frame.type === "comment.deleted") {
        setComments((current) => removeCommentById(current, frame.commentId));
        return;
      }
      // Deduped by id, not by "is this my own comment": the same viewer can
      // have this panel open on two devices (or two tabs), and a userId guard
      // dropped the frame in *every* one of them, not just the tab that
      // posted — see `postBackendComment`, which resolves the matching race
      // in the other direction by yielding to whichever of the frame or the
      // HTTP response lands first.
      Promise.all([
        resolveAuthor(frame.userId ?? ""),
        frame.replyToUserId ? resolveAuthor(frame.replyToUserId) : Promise.resolve(null),
      ])
        .then(([author, replyToAuthor]) => {
          setComments((current) => {
            // Checks replies too: a reply already attached is not a top-level
            // absence, and re-inserting it would show the same row twice.
            if (hasCommentId(current, frame.commentId)) return current;
            const ui: Comment = {
              id: frame.commentId,
              author,
              text: frame.content ?? "",
              timestamp: formatRelativeTime(frame.createdAt ?? new Date().toISOString()),
              likes: 0,
              replyToName: replyToAuthor?.nickname,
            };
            if (!frame.parentId) return [ui, ...current];
            // Parent not on a loaded page yet — same holding pen `loadMore`
            // uses, so it attaches as soon as its page arrives.
            if (!current.some((comment) => comment.id === frame.parentId)) {
              pendingRepliesRef.current.push({ ui, parentId: frame.parentId });
              return current;
            }
            return addReply(current, frame.parentId, ui);
          });
          // No count bump here: the counts frame carries the authoritative
          // comment total. Counting the row *and* the poster's optimistic
          // bump made every comment worth +2 on the device that wrote it.
        })
        .catch(() => {
          // Author lookup failed — skip rather than show a comment with no author.
        });
    },
    [videoId],
  );

  useCommentRealtime(videoId, isBackend ? token : null, applyRealtimeFrame);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(videoId, cursor);
      const entries = await toUiComments(page.items);
      setComments((current) => mergeComments(current, entries, pendingRepliesRef.current));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Stay put — the button is still there to retry.
    } finally {
      setLoadingMore(false);
    }
  }, [videoId, cursor, loadingMore]);

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

  /**
   * One fetched page of a thread, folded in under its parent.
   *
   * ponytail: appended, so a reply posted locally before the thread was opened
   * sits above the older server replies that arrive after it. Sorting by
   * snowflake id would fix it, and the optimistic `pending-*` ids do not have
   * one — not worth it for the one row the poster already knows they wrote.
   */
  const appendReplies = useCallback((parentId: string, entries: Comment[]) => {
    setComments((current) =>
      current.map((comment) => {
        if (comment.id !== parentId) return comment;
        const known = new Set((comment.replies ?? []).map((reply) => reply.id));
        return {
          ...comment,
          replies: [
            ...(comment.replies ?? []),
            ...entries.filter((entry) => !known.has(entry.id)),
          ],
        };
      }),
    );
  }, []);

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
        // `applyRealtimeFrame`), so remapping would leave two rows with
        // the same id; drop the placeholder and keep the one already there
        // instead.
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
    // A real video persists both a top-level comment and a reply through
    // interaction-service; the mock path keeps everything local.
    if (isBackend) {
      void postBackendComment(text, replyTo);
      setReplyTo(null);
      return;
    }

    const entry: Comment = {
      id: `local-${Date.now()}`,
      author: user ?? CURRENT_USER,
      text,
      timestamp: "now",
      likes: 0,
      replyToName: replyTo?.replyToName,
    };

    setComments((current) =>
      replyTo
        ? addReply(current, replyTo.parentId, entry)
        : // A brand new top-level comment lands at the top of the list.
          [entry, ...current],
    );
    setJustAddedId(entry.id);
    if (!replyTo) listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setReplyTo(null);
    onCommentAdded();
  };

  const deleteOwnComment = async (id: string) => {
    invalidateCommentPage(videoId);
    const previous = comments;
    setComments((current) => removeCommentById(current, id));
    onCommentDeleted();
    if (!isBackend) {
      toast.success("Comment deleted.");
      return;
    }
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
          (commentsDisabled ? (
            <CommentsOff />
          ) : loading && commentCount > 0 ? (
            <CommentListSkeleton
              count={Math.min(commentCount, COMMENT_FIRST_PAGE_SIZE)}
            />
          ) : (
            <NoCommentsYet />
          ))}

        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            videoId={videoId}
            isBackend={isBackend}
            onReply={startReply}
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

      {!commentsDisabled && (
        <CommentComposer
          ref={composerRef}
          replyTo={replyTo}
          onCancelReply={() => setReplyTo(null)}
          onPost={post}
        />
      )}
    </section>
  );
}
