"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";

import {
  ArrowPostIcon,
  AtIcon,
  CloseIcon,
  CommentIcon,
  EmojiIcon,
  HeartIcon,
} from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { isBackendHandle } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import {
  addComment,
  deleteComment as deleteCommentApi,
  listComments,
} from "@/lib/api/interactions";
import { cn } from "@/lib/utils";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-feed";
import type { Comment } from "@/types/tiktok";

/** Removes a comment wherever it lives — top-level, or nested one reply deep. */
function removeCommentById(list: Comment[], id: string): Comment[] {
  return list
    .filter((comment) => comment.id !== id)
    .map((comment) =>
      comment.replies
        ? { ...comment, replies: removeCommentById(comment.replies, id) }
        : comment,
    );
}

/** Which comment thread the composer is aimed at, if any. */
interface ReplyTarget {
  /** Top-level comment the reply gets appended to (TikTok nests one level). */
  parentId: string;
  /** Handle shown in the composer placeholder — may be a reply's author. */
  username: string;
}

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
  comments: initialComments,
  commentCount,
  onClose,
  onCommentAdded,
  onCommentDeleted,
  variant = "sidebar",
}: {
  /** Backend id (numeric) fetches real comments; a mock id keeps `comments` as-is. */
  videoId: string;
  /** This video's comments as loaded by the page — used only for mock ids. */
  comments: Comment[];
  /** Total shown in the header — the loaded count plus anything posted here. */
  commentCount: number;
  onClose: () => void;
  onCommentAdded: () => void;
  /** Fired after a comment is removed, so the caller's count stays in sync. */
  onCommentDeleted: () => void;
  /**
   * `sidebar` is the feed's collapsible panel, sized and shadowed as above.
   * `detail` is the lower half of `/video/[id]`'s right column, which is wider
   * than the feed's sidebar and never collapses, so the width caps and the
   * edge shadow that separates a floating panel do not apply.
   */
  variant?: "sidebar" | "detail";
}) {
  const isDetail = variant === "detail";
  const isBackend = isBackendHandle(videoId);
  const { user } = useSession();
  const [comments, setComments] = useState<Comment[]>(isBackend ? [] : initialComments);
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  /** Newest locally-posted comment — drives the slide-in and the auto-expand. */
  const [justAddedId, setJustAddedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(isBackend);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const composerRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /** interaction-service's flat DTO → the UI's `Comment`, author resolved by id. */
  const toUiComment = useCallback(async (raw: {
    commentId: string;
    userId: string;
    content: string;
    createdAt: string;
  }): Promise<Comment> => ({
    id: raw.commentId,
    author: await resolveAuthor(raw.userId),
    text: raw.content,
    timestamp: formatRelativeTime(raw.createdAt),
    likes: 0,
  }), []);

  // Real comments load once per video; the mock path keeps the prop as its
  // whole state, unchanged from before this was wired up.
  useEffect(() => {
    if (!isBackend) return;
    let cancelled = false;
    setLoading(true);

    listComments(videoId)
      .then(async (page) => {
        const items = await Promise.all(page.items.map(toUiComment));
        if (cancelled) return;
        setComments(items);
        setCursor(page.nextCursor);
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
  }, [videoId, isBackend, toUiComment]);

  const loadMore = async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(videoId, cursor);
      const items = await Promise.all(page.items.map(toUiComment));
      setComments((current) => [...current, ...items]);
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Stay put — the button is still there to retry.
    } finally {
      setLoadingMore(false);
    }
  };

  const startReply = (target: ReplyTarget) => {
    setReplyTo(target);
    composerRef.current?.focus();
  };

  const postBackendComment = async (text: string) => {
    if (!user) return;
    const optimistic: Comment = {
      id: `pending-${Date.now()}`,
      author: user,
      text,
      timestamp: "now",
      likes: 0,
    };
    setComments((current) => [optimistic, ...current]);
    setJustAddedId(optimistic.id);
    listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    onCommentAdded();

    try {
      const saved = await addComment(videoId, text);
      setComments((current) =>
        current.map((comment) =>
          comment.id === optimistic.id ? { ...comment, id: saved.commentId } : comment,
        ),
      );
    } catch {
      // Silent rollback: undo both the optimistic row and the count bump.
      setComments((current) => removeCommentById(current, optimistic.id));
      onCommentDeleted();
    }
  };

  const post = (text: string) => {
    // A reply has nowhere to live on the backend — CommentByVideo is flat —
    // so a reply always stays a local, this-session-only addition, on both a
    // mock video and a real one.
    if (isBackend && !replyTo) {
      void postBackendComment(text);
      setReplyTo(null);
      return;
    }

    const entry: Comment = {
      id: `local-${Date.now()}`,
      author: CURRENT_USER,
      text,
      timestamp: "now",
      likes: 0,
    };

    setComments((current) =>
      replyTo
        ? current.map((comment) =>
            comment.id === replyTo.parentId
              ? { ...comment, replies: [...(comment.replies ?? []), entry] }
              : comment,
          )
        : // A brand new top-level comment lands at the top of the list.
          [entry, ...current],
    );
    setJustAddedId(entry.id);
    if (!replyTo) listRef.current?.scrollTo({ top: 0, behavior: "smooth" });
    setReplyTo(null);
    onCommentAdded();
  };

  const deleteOwnComment = async (id: string) => {
    const previous = comments;
    setComments((current) => removeCommentById(current, id));
    onCommentDeleted();
    if (!isBackend) return;
    try {
      await deleteCommentApi(videoId, id);
    } catch {
      // Silent rollback, same as everywhere else here.
      setComments(previous);
      onCommentAdded();
    }
  };

  return (
    <section
      className={cn(
        "sticky top-0 z-10 flex h-full max-h-screen flex-col",
        "bg-[var(--tt-page)] px-4 pb-5 pt-4",
        isDetail
          ? "w-full min-w-0"
          : "min-w-72 max-w-96 shadow-[-1px_0_1px_var(--tt-divider)]",
      )}
    >
      {/* `.DivCommentHeader` — flex, space-between, padding-bottom 16px. */}
      <header className="flex flex-none items-center justify-between pb-4">
        {/* `.DivCommentHeaderTextWrapper` — gap .25rem, 17px/700/25.5px */}
        <div className="flex items-center gap-1">
          <span className="text-[17px] font-bold leading-[25.5px] text-[var(--tt-text)]">
            Comments
          </span>
          <span className="text-[17px] font-bold leading-[25.5px] text-[var(--tt-text)]">
            ({formatCount(commentCount)})
          </span>
        </div>
        {/* The detail column has no panel of its own to dismiss — the page's
            own close control sits over the player. */}
        {!isDetail && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
          >
            <CloseIcon className="h-[18px] w-[18px]" />
          </button>
        )}
      </header>

      {/* `.DivCommentMain` — flex-grow 1, overflow-y scroll, scrollbar-width none */}
      <div
        ref={listRef}
        className="no-scrollbar flex-1 overflow-y-scroll [overscroll-behavior:contain]"
      >
        {loading && comments.length === 0 && <CommentListSkeleton />}

        {comments.map((comment) => (
          <CommentItem
            key={comment.id}
            comment={comment}
            onReply={startReply}
            justAddedId={justAddedId}
            currentUserId={user?.userId}
            onDelete={deleteOwnComment}
          />
        ))}

        {hasMore && (
          <button
            type="button"
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-2 text-center text-[14px] font-medium text-white/60 hover:underline disabled:opacity-40"
          >
            {loadingMore ? "Loading…" : "Load more comments"}
          </button>
        )}
      </div>

      <CommentComposer
        ref={composerRef}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onPost={post}
      />
    </section>
  );
}

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
 */
function CommentListSkeleton() {
  return (
    <div className="flex flex-col gap-4 py-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-3">
          <Skeleton className="h-8 w-8 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  isReply = false,
  onReply,
  justAddedId,
  /** Thread this item belongs to — a reply's replies go to its parent. */
  parentId,
  currentUserId,
  onDelete,
}: {
  comment: Comment;
  isReply?: boolean;
  onReply?: (target: ReplyTarget) => void;
  justAddedId?: string | null;
  parentId?: string;
  /** The signed-in viewer's id — only their own comments can be deleted. */
  currentUserId?: string;
  onDelete?: (id: string) => void;
}) {
  const [liked, setLiked] = useState(false);
  const avatarSize = isReply ? 24 : 32;
  // Mock authors carry no `userId`, so this is false for every mock comment —
  // the "⋯" stays decorative there, same as before this was wired up.
  const canDelete = Boolean(currentUserId) && comment.author.userId === currentUserId;

  return (
    <div
      className={cn(
        "flex flex-col gap-4",
        !isReply && "mb-6",
        comment.id === justAddedId &&
          "animate-[tt-comment-in_320ms_ease-out] rounded-lg",
      )}
    >
      <div className="flex flex-row items-center gap-2">
        <Image
          src={comment.author.avatarUrl}
          alt={comment.author.nickname}
          width={avatarSize}
          height={avatarSize}
          className={cn(
            "flex-none self-start rounded-full object-cover",
            isReply ? "h-6 w-6" : "h-8 w-8",
          )}
        />

        <div className="flex flex-1 flex-col items-start gap-1.5 [overflow-wrap:break-word] [word-break:break-word]">
          {/* `.DivCommentHeaderWrapper` — username left, "⋯" right */}
          <div className="flex w-full items-center justify-between">
            <div className={cn("flex items-center", isReply ? "gap-[3px]" : "gap-1.5")}>
              <p className="text-[13px] font-medium leading-[16.9px] text-[var(--tt-icon)]">
                {comment.author.nickname}
              </p>
              {comment.isCreator && (
                <span className="rounded-[4px] bg-[var(--tt-field)] px-1 text-[11px] font-medium leading-4 text-[var(--tt-text-secondary)]">
                  Creator
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={canDelete ? () => onDelete?.(comment.id) : undefined}
              aria-label={canDelete ? "Delete comment" : "More options"}
              className="flex h-5 w-3.5 flex-none items-center justify-center text-white/60 hover:text-[var(--tt-text)]"
            >
              <MoreDotsGlyph />
            </button>
          </div>

          <span className="text-[15px] font-medium leading-[22.5px] text-[var(--tt-icon)]">
            {comment.text}
          </span>

          {/* `.DivCommentSubContentSplitWrapper` — space-between */}
          <div className="flex w-full items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] leading-[19.5px] text-[var(--tt-placeholder)]">
                {comment.timestamp}
              </span>
              <button
                type="button"
                onClick={() =>
                  onReply?.({
                    parentId: parentId ?? comment.id,
                    username: comment.author.username,
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
            </div>

            <button
              type="button"
              onClick={() => setLiked((v) => !v)}
              aria-label="Like comment"
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
                {formatCount(comment.likes + (liked ? 1 : 0))}
              </span>
            </button>
          </div>
        </div>
      </div>

      {!isReply && comment.replies && comment.replies.length > 0 && (
        <ReplyThread
          replies={comment.replies}
          parentId={comment.id}
          onReply={onReply}
          justAddedId={justAddedId}
        />
      )}
    </div>
  );
}

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
 * Expanded, the chevron goes away and the same wrapper holds plain 14/500/21px
 * controls. The live site paginates there ("View 1 more" next to "Hide"); this
 * clone ships every reply in one go, so only "Hide" is rendered.
 */
function ReplyThread({
  replies,
  parentId,
  onReply,
  justAddedId,
}: {
  replies: Comment[];
  parentId: string;
  onReply?: (target: ReplyTarget) => void;
  justAddedId?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);

  // Posting a reply into a collapsed thread has to reveal it, or the comment
  // the user just wrote would appear to vanish. Adjusting state during render
  // (rather than in an effect) is React's sanctioned way to react to a changed
  // prop; `revealedFor` makes it fire once, so "Hide" still works afterwards.
  if (
    justAddedId &&
    justAddedId !== revealedFor &&
    replies.some((reply) => reply.id === justAddedId)
  ) {
    setRevealedFor(justAddedId);
    setExpanded(true);
  }

  return (
    <div className="ml-[52px] flex flex-col gap-4">
      {expanded &&
        replies.map((reply) => (
          <CommentItem
            key={reply.id}
            comment={reply}
            isReply
            parentId={parentId}
            onReply={onReply}
            justAddedId={justAddedId}
          />
        ))}

      <div className="-ml-1.5 flex flex-row items-center gap-2">
        <div className="flex flex-row items-center gap-1.5">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className={cn(
              "py-px font-medium text-white/60 hover:underline",
              expanded ? "text-[14px] leading-[21px]" : "text-[14px] leading-[18px]",
            )}
          >
            {expanded
              ? "Hide"
              : `View ${replies.length} ${replies.length === 1 ? "reply" : "replies"}`}
          </button>
          {!expanded && <ChevronDownGlyph />}
        </div>
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

/**
 * `.DivCommentFooter` > `.DivCommentBarContainer` — 42px tall.
 *   avatar               32×32, border-radius 50%
 *   `.DivTextInputContainer`  height 42, background rgba(255,255,255,.13),
 *                             border-radius 22px, padding 0 8px
 *   two ghost TUXButtons      32×32, border-radius 8px, padding 4px
 *   `.ArrowPostButton`        32×32, background #fe2c55, border-radius 999px
 *
 * Reply mode — placeholder swap plus a cancel affordance — is a
 * **reconstruction, not an extraction**. The live "Reply" control did not
 * respond to a synthetic click or to a positioned real click in two attempts,
 * and I stopped there rather than keep clicking around a comment box on a
 * signed-in account, where an accidental hit could post something. So the
 * placeholder wording and the ✕ are invented; only the bar's geometry above is
 * measured.
 */
function CommentComposer({
  ref,
  replyTo,
  onCancelReply,
  onPost,
}: {
  ref: React.RefObject<HTMLInputElement | null>;
  replyTo: ReplyTarget | null;
  onCancelReply: () => void;
  onPost: (text: string) => void;
}) {
  const [value, setValue] = useState("");
  const canPost = value.trim() !== "";
  const { user, openLogin } = useSession();

  const submit = () => {
    if (!canPost) return;
    onPost(value.trim());
    setValue("");
  };

  /*
   * Signed out, the live panel still loads and lets a guest read every comment
   * — only the composer is replaced. `.DivCommentFooter` keeps its 64px, and
   * `.StyledLoginButton` fills the column: 352 × 40 at the measured width,
   * `#FE2C55`, `border-radius: 999px`, a 20px glyph and a 16px/600 label with
   * 4px between them, the bar sitting 16px below the list.
   */
  if (!user) {
    return (
      <div className="flex h-16 flex-none items-end">
        <button
          type="button"
          onClick={openLogin}
          className="flex h-10 w-full items-center justify-center gap-1 rounded-full bg-[var(--tt-red)] px-3 text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-red-hover)]"
        >
          <CommentIcon className="h-5 w-5 flex-none" />
          <span className="text-[16px] font-semibold text-white">
            Log in to comment
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-none flex-col pt-3">
      {/* Reply banner — names the thread the composer is aimed at. */}
      {replyTo && (
        <div className="mb-2 flex animate-[tt-comment-in_200ms_ease-out] items-center justify-between rounded-[8px] bg-[var(--tt-field)] px-3 py-1.5">
          <span className="truncate text-[13px] leading-[19.5px] text-[var(--tt-text-secondary)]">
            Replying to{" "}
            <span className="font-semibold text-[var(--tt-text)]">
              @{replyTo.username}
            </span>
          </span>
          <button
            type="button"
            onClick={() => {
              onCancelReply();
              setValue("");
            }}
            aria-label="Cancel reply"
            className="ml-2 flex h-5 w-5 flex-none items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
          >
            <CloseIcon className="h-3 w-3" />
          </button>
        </div>
      )}

      <div className="flex items-center gap-2">
      <Image
        src={CURRENT_USER.avatarUrl}
        alt={CURRENT_USER.nickname}
        width={32}
        height={32}
        className="h-8 w-8 flex-none rounded-full object-cover"
      />

      <div className="flex h-[42px] flex-1 items-center gap-1 rounded-[22px] bg-[var(--tt-field)] px-2">
        <input
          ref={ref}
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") submit();
            if (event.key === "Escape" && replyTo) onCancelReply();
          }}
          placeholder={
            replyTo ? `Reply to @${replyTo.username}...` : "Add comment..."
          }
          aria-label={
            replyTo ? `Reply to ${replyTo.username}` : "Add comment"
          }
          className="min-w-0 flex-1 bg-transparent px-1 text-[14px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)]"
        />
        <button
          type="button"
          aria-label="Emoji"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <EmojiIcon className="h-5 w-5" />
        </button>
        <button
          type="button"
          aria-label="Mention"
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <AtIcon className="h-5 w-5" />
        </button>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={!canPost}
        aria-label={replyTo ? "Post reply" : "Post comment"}
        className={cn(
          "flex h-8 w-8 flex-none items-center justify-center rounded-full bg-[var(--tt-red)] p-2 text-white",
          "transition-[opacity,background-color] disabled:opacity-40",
          canPost && "hover:bg-[var(--tt-red-hover)]",
        )}
      >
        <ArrowPostIcon className="h-4 w-4" />
      </button>
      </div>
    </div>
  );
}
