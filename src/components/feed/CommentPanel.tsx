"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { Trash2 } from "lucide-react";

import {
  ArrowPostIcon,
  AtIcon,
  CloseIcon,
  CommentIcon,
  EmojiIcon,
  HeartIcon,
  ReportIcon,
} from "@/components/icons";
import { ReportDialog } from "@/components/report/ReportDialog";
import { COMMENT_REPORT_REASONS } from "@/lib/api/reports";
import { useSession } from "@/components/session/SessionProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_AVATAR, isBackendHandle } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import {
  COMMENT_FIRST_PAGE_SIZE,
  addComment,
  deleteComment as deleteCommentApi,
  likeComment,
  listComments,
  listReplies,
  REPLY_PAGE_SIZE,
  unlikeComment,
} from "@/lib/api/interactions";
import { getAccessToken } from "@/lib/api/tokens";
import { getFollowing, searchUsers } from "@/lib/api/users";
import type { UserProfileResponse } from "@/lib/api/types";
import { getStompClient, onStompConnect } from "@/lib/realtime/stompClient";
import {
  type CommentEntry,
  type CommentPage,
  invalidateCommentPage,
  loadFirstCommentPage,
  peekCommentPage,
  toUiComments,
} from "@/lib/comment-cache";
import { cn } from "@/lib/utils";
import { formatCount, formatRelativeTime } from "@/lib/format";
import { CURRENT_USER } from "@/lib/mock-feed";
import { toast } from "@/components/ui/toast";
import type { Comment } from "@/types/tiktok";

/**
 * One message on `/topic/videos.{videoId}.comments`. Mirrors
 * `CommentFrame` in chat-service — see that file for field docs. `parentId`
 * is the top-level comment a reply hangs under (already flattened one level
 * deep by interaction-service) and is absent on a top-level comment.
 */
type CommentRealtimeFrame = {
  type: "comment.created" | "comment.deleted" | "comment.liked";
  videoId: string;
  commentId: string;
  userId?: string;
  content?: string;
  createdAt?: string;
  parentId?: string;
  replyToUserId?: string;
  likeCount?: number;
};

/** Matches interaction-service `AddCommentRequest` `@Size(max = 150)`. */
const COMMENT_MAX_LENGTH = 150;

/** Sets a comment's like tally wherever it lives — top-level, or nested one reply deep. */
function setCommentLikes(list: Comment[], id: string, likes: number): Comment[] {
  return list.map((comment) => {
    if (comment.id === id) return { ...comment, likes };
    if (!comment.replies?.some((reply) => reply.id === id)) return comment;
    return {
      ...comment,
      replies: comment.replies.map((reply) =>
        reply.id === id ? { ...reply, likes } : reply,
      ),
    };
  });
}

/**
 * Removes a comment wherever it lives — top-level, or nested one reply deep —
 * and takes its parent's "View N replies" tally down with it, which is the
 * number the thread pages against.
 */
function removeCommentById(list: Comment[], id: string): Comment[] {
  return list
    .filter((comment) => comment.id !== id)
    .map((comment) => {
      if (!comment.replies?.some((reply) => reply.id === id)) return comment;
      return {
        ...comment,
        replies: comment.replies.filter((reply) => reply.id !== id),
        replyCount: Math.max(0, (comment.replyCount ?? 1) - 1),
      };
    });
}

/** Hangs one reply off its parent and moves the tally the thread pages against. */
function addReply(list: Comment[], parentId: string, reply: Comment): Comment[] {
  return list.map((comment) =>
    comment.id === parentId
      ? {
          ...comment,
          replies: [...(comment.replies ?? []), reply],
          replyCount: (comment.replyCount ?? 0) + 1,
        }
      : comment,
  );
}

/** True if a comment with `id` is already in the list — top-level or one reply deep. */
function hasCommentId(list: Comment[], id: string): boolean {
  return list.some(
    (comment) => comment.id === id || comment.replies?.some((reply) => reply.id === id),
  );
}

/** Swaps an optimistic id for the real one once the server responds — top-level or one reply deep. */
function remapCommentId(list: Comment[], fromId: string, toId: string): Comment[] {
  return list.map((comment) => {
    if (comment.id === fromId) return { ...comment, id: toId };
    if (comment.replies?.some((reply) => reply.id === fromId)) {
      return {
        ...comment,
        replies: comment.replies.map((reply) =>
          reply.id === fromId ? { ...reply, id: toId } : reply,
        ),
      };
    }
    return comment;
  });
}

/**
 * Folds a freshly-fetched page of top-level comments into the list on screen.
 * `listComments` returns top-level comments only — a thread is fetched behind
 * its own "View N replies" — so the only replies here are ones a realtime
 * frame delivered before its parent's page had loaded; those wait in `pending`
 * and attach as soon as the parent arrives.
 */
function mergeComments(
  existing: Comment[],
  incoming: CommentEntry[],
  pending: { ui: Comment; parentId: string }[],
): Comment[] {
  const next: Comment[] = [...existing];
  const known = new Set(next.map((comment) => comment.id));

  for (const { ui } of incoming) {
    if (known.has(ui.id)) continue;
    next.push(ui);
    known.add(ui.id);
  }
  for (let i = pending.length - 1; i >= 0; i -= 1) {
    if (!known.has(pending[i].parentId)) continue;
    const { ui, parentId } = pending.splice(i, 1)[0];
    return mergeComments(addReply(next, parentId, ui), [], pending);
  }
  return next;
}

/**
 * Composer emoji tray. The live picker is a searchable panel backed by a full
 * unicode set; this keeps the same insert behaviour over a grouped subset —
 * the rows TikTok surfaces first, scrollable rather than searchable.
 */
const COMPOSER_EMOJI_GROUPS = [
  {
    label: "Smileys",
    emojis: [
      "😀", "😃", "😄", "😁", "😆", "😅", "😂", "🤣",
      "😊", "😇", "🙂", "🙃", "😉", "😌", "😍", "🥰",
      "😘", "😗", "😚", "😋", "😛", "😜", "🤪", "🤩",
      "😎", "🤓", "🧐", "🤔", "🤨", "😐", "😶", "😒",
      "🙄", "😬", "🤥", "😪", "😴", "🤧", "🥵", "🥶",
      "🥴", "😵", "🤯", "🤠", "🥳", "🥸", "😏", "😝",
    ],
  },
  {
    label: "Feelings",
    emojis: [
      "😔", "😟", "🙁", "😫", "😩", "😢", "😭", "😤",
      "😠", "😡", "🤬", "😱", "😨", "😰", "😥", "😓",
      "🤗", "🤭", "🤫", "🥱", "🥺", "🥹", "😮", "😯",
      "🤐", "😑", "🙄", "🤡", "💀", "👻", "👽", "🤖",
    ],
  },
  {
    label: "Gestures",
    emojis: [
      "👍", "👎", "👌", "👏", "🙌", "🙏", "🤝", "💪",
      "🤙", "🤘", "🤟", "👊", "✊", "✌️", "🤞", "👆",
      "👇", "👈", "👉", "🖕", "🖐", "👋", "👀", "👁",
    ],
  },
  {
    label: "Hearts",
    emojis: [
      "❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "🤍",
      "🤎", "💔", "💕", "💞", "💓", "💗", "💖", "💘",
      "💝", "💌", "💋", "💯", "🔥", "✨", "⭐", "🌟",
    ],
  },
  {
    label: "Fun",
    emojis: [
      "🎉", "🎊", "🎁", "🎂", "🍻", "🥂", "🎵", "🎶",
      "🎤", "🎮", "⚽", "🏀", "🏆", "🥇", "🚀", "✈️",
      "🌈", "☀️", "🌛", "⚡", "💥", "💦", "🍃", "🌹",
      "🍀", "🐰", "🐱", "🐶", "🐬", "🦄", "🐸", "🐵",
    ],
  },
] as const;

/** How many accounts the mention list offers at once. */
const MENTION_LIMIT = 6;
/** Same debounce as the search drawer — one request per pause, not per key. */
const MENTION_DEBOUNCE_MS = 250;

/** The "@word" being typed at the caret, if there is one. */
function mentionTokenAt(
  value: string,
  caret: number,
): { start: number; query: string } | null {
  const before = value.slice(0, caret);
  const at = before.lastIndexOf("@");
  // Only a fresh word starts a mention: "a@b" is an address, not a tag.
  if (at === -1 || (at > 0 && !/\s/.test(before[at - 1]))) return null;
  const query = before.slice(at + 1);
  // A space ends the token — the mention list closes rather than following on.
  return /\s/.test(query) ? null : { start: at, query };
}

/**
 * What gets typed into the comment. Most backend accounts have no handle
 * (user-service stores none for older rows), so the display name stands in with
 * its spaces squeezed out — a mention is plain text here, not an entity the API
 * resolves, so it only has to read as one.
 */
function mentionHandle(profile: UserProfileResponse): string {
  if (profile.username) return profile.username;
  const name = profile.displayName ?? `user${profile.userId}`;
  return name.replace(/\s+/g, "");
}

/** Which comment thread the composer is aimed at, if any. */
interface ReplyTarget {
  /** Top-level comment the reply gets appended to (TikTok nests one level). */
  parentId: string;
  /** Handle shown in the composer placeholder — may be a reply's author. */
  username: string;
  /**
   * Id of the comment whose "Reply" was actually clicked — sent to the backend, which flattens a
   * reply-to-a-reply onto its top-level ancestor and derives `replyToUserId` from it. Equals
   * `parentId` when replying straight to a top-level comment.
   */
  replyToCommentId?: string;
  /** Name for the "author › replyToName" label — set only when replying to another reply. */
  replyToName?: string;
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
  // dependency the realtime-subscribe effect below can react to — reading it
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
  const pendingRepliesRef = useRef<{ ui: Comment; parentId: string }[]>([]);

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
   * The panel is only ever mounted while the sidebar is open for this video
   * (`Feed` unmounts it on close and re-keys it per video), so subscribing
   * here for the panel's lifetime already matches "subscribe while open,
   * unsubscribe when it's shut" — no separate open/close flag needed.
   */
  useEffect(() => {
    if (!isBackend) return;
    if (!token) return;

    const client = getStompClient(token);
    let subscription: { unsubscribe: () => void } | null = null;

    const onComment = (frame: CommentRealtimeFrame) => {
      // Whatever the frame says, this video's cached first page is now stale.
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
    };

    const subscribe = () => {
      if (!client.connected) return;
      subscription = client.subscribe(`/topic/videos.${videoId}.comments`, (message) => {
        onComment(JSON.parse(message.body) as CommentRealtimeFrame);
      });
    };
    subscribe();
    const unsubscribeConnect = onStompConnect(subscribe);

    return () => {
      unsubscribeConnect();
      subscription?.unsubscribe();
    };
  }, [videoId, isBackend, token, onCommentAdded]);

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
        // the subscription above), so remapping would leave two rows with
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
function NoCommentsYet() {
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
function CommentsOff() {
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
function CommentText({ text }: { text: string }) {
  const parts = text.split(/(@[\p{L}\p{N}_.]+)/gu);
  return (
    <>
      {parts.map((part, i) => {
        // Same rule the composer tags by: a mention starts a word, so
        // "mail@x.com" stays plain text.
        const isMention =
          part.length > 1 &&
          part.startsWith("@") &&
          (i === 0 || parts[i - 1] === "" || /\s$/.test(parts[i - 1]));
        return isMention ? (
          <span key={i} className="text-[var(--tt-mention)]">
            {part}
          </span>
        ) : (
          part
        );
      })}
    </>
  );
}

function CommentItem({
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
  // Someone else's comment on a real video: report it instead. A mock comment
  // or an optimistic row not yet saved has no id admin-service could act on.
  const canReport = !canDelete && canPersistLike;
  const menuHasItems = canDelete || canReport;

  /* Click anywhere else — including the next comment's "⋯" — closes the menu. */
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [menuOpen]);

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
                aria-expanded={menuHasItems ? menuOpen : undefined}
                className="flex h-5 w-3.5 items-center justify-center text-white/60 hover:text-[var(--tt-text)]"
              >
                <MoreDotsGlyph />
              </button>

              {/* The viewer's own comment (or one on their video) can be
                  deleted; anyone else's can be reported. */}
              {menuOpen && menuHasItems && (
                <div className="absolute right-0 top-6 z-20 w-max animate-[tt-comment-in_150ms_ease-out] overflow-hidden rounded-[8px] border border-[var(--tt-divider)] bg-black shadow-lg">
                  {canDelete ? (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        onDelete?.(comment.id);
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-[14px] font-medium text-[var(--tt-text)] transition-colors duration-200 ease-out hover:text-[var(--tt-red)]"
                    >
                      <Trash2 className="h-4 w-4 flex-none" strokeWidth={2} />
                      Delete
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        if (!user) {
                          openLogin();
                          return;
                        }
                        setReportOpen(true);
                      }}
                      className="flex w-full items-center gap-2 whitespace-nowrap px-3 py-2 text-[14px] font-medium text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-[var(--tt-shape-neutral-3)]"
                    >
                      <ReportIcon className="h-4 w-4 flex-none" />
                      Report
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
              <button
                type="button"
                onClick={() =>
                  onReply?.({
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
          onReply={onReply}
          justAddedId={justAddedId}
          onRepliesLoaded={onRepliesLoaded}
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
 * Expanded, the wrapper becomes `justify-between`: "View N replies" keeps the
 * left slot and "Hide" takes the right, matching the live site's pagination.
 * Replies come down `REPLY_PAGE_SIZE` at a time, one request per click — a
 * comment with 30 replies costs nothing until somebody opens it.
 */
function ReplyThread({
  replies,
  replyCount,
  parentId,
  videoId,
  isBackend,
  onReply,
  justAddedId,
  onRepliesLoaded,
}: {
  /** The replies already loaded — fetched pages plus anything posted locally. */
  replies: Comment[];
  /** What the server says the thread holds, which is what the button counts down. */
  replyCount: number;
  parentId: string;
  videoId: string;
  isBackend: boolean;
  onReply?: (target: ReplyTarget) => void;
  justAddedId?: string | null;
  onRepliesLoaded?: (parentId: string, replies: Comment[]) => void;
}) {
  /** How many replies are on screen — 0 is the collapsed thread. */
  const [shownCount, setShownCount] = useState(0);
  const [revealedFor, setRevealedFor] = useState<string | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  /** Mock videos have no thread endpoint: their replies are all in the prop already. */
  const [exhausted, setExhausted] = useState(!isBackend);
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
        <CommentItem
          key={reply.id}
          comment={reply}
          videoId={videoId}
          isBackend={isBackend}
          isReply
          parentId={parentId}
          onReply={onReply}
          justAddedId={justAddedId}
        />
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [mention, setMention] = useState<{ start: number; query: string } | null>(null);
  const [mentionResults, setMentionResults] = useState<UserProfileResponse[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);
  const [limitHit, setLimitHit] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);
  const canPost = value.trim() !== "";
  const { user, openLogin } = useSession();
  const mentionQuery = mention?.query ?? null;
  const mentionOpen = mention !== null && mentionResults.length > 0;

  /* The "max reached" hint is transient — clear it a couple seconds after the
     last blocked keystroke. */
  useEffect(() => {
    if (!limitHit) return;
    const id = window.setTimeout(() => setLimitHit(false), 3500);
    return () => window.clearTimeout(id);
  }, [limitHit]);

  /* Any click outside the bar dismisses whichever tray is open. */
  useEffect(() => {
    if (!emojiOpen && mention === null) return;
    const onPointerDown = (event: MouseEvent) => {
      if (barRef.current?.contains(event.target as Node)) return;
      setEmojiOpen(false);
      setMention(null);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, [emojiOpen, mention]);

  /*
   * Who can be tagged: with nothing typed after the "@", the accounts the
   * viewer follows; from the first character on, user-service's search over
   * every account. Both need a token, so a signed-out viewer never gets here.
   */
  useEffect(() => {
    if (mentionQuery === null || !user) return;
    const controller = new AbortController();
    const timer = setTimeout(() => {
      const request = mentionQuery
        ? searchUsers(mentionQuery, MENTION_LIMIT, controller.signal)
        : getFollowing(user.userId, 0, MENTION_LIMIT);
      request
        .then((page) => {
          if (controller.signal.aborted) return;
          setMentionResults(page.content.filter((p) => p.userId !== user.userId));
          setMentionIndex(0);
        })
        .catch(() => {
          // Aborted or failed — the previous list stays rather than blinking out.
        });
    }, MENTION_DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [mentionQuery, user]);

  /* Re-read the token on every keystroke and every caret move. */
  const syncMention = (nextValue: string, caret: number | null) => {
    const token = mentionTokenAt(nextValue, caret ?? nextValue.length);
    // Dropping the token drops its results too, so reopening never flashes the
    // answers to a query the viewer has already typed past.
    if (!token) setMentionResults([]);
    setMention(token);
  };

  /** Swap the half-typed "@tok" for the picked handle and carry on typing. */
  const applyMention = (profile: UserProfileResponse) => {
    if (!mention) return;
    const input = ref.current;
    const caret = input?.selectionStart ?? value.length;
    const handle = `@${mentionHandle(profile)} `;
    setValue(value.slice(0, mention.start) + handle + value.slice(caret));
    const next = mention.start + handle.length;
    setMention(null);
    setMentionResults([]);
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(next, next);
    });
  };

  /* Insert at the caret (replacing any selection) and keep typing where it lands. */
  const insertAtCaret = (text: string) => {
    const input = ref.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    setValue(value.slice(0, start) + text + value.slice(end));
    const caret = start + text.length;
    requestAnimationFrame(() => {
      input?.focus();
      input?.setSelectionRange(caret, caret);
    });
  };

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
    <div className="relative flex flex-none flex-col pt-3">
      {/* Max-length hint — floats above the bar (opaque background, z-30) so its
          show/hide neither reflows the comment list nor shows through it.
          Kept mounted and toggled by class so it animates in AND out. */}
      <p
        role="status"
        aria-hidden={!limitHit}
        className={cn(
          "pointer-events-none absolute inset-x-0 bottom-full z-30 mb-1.5 rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] px-3 py-1.5 text-[12px] leading-[16px] text-[#f6708a] shadow-lg transition-all duration-150 ease-out",
          limitHit ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0",
        )}
      >
        Bình luận tối đa {COMMENT_MAX_LENGTH} ký tự.
      </p>


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

      <div ref={barRef} className="relative flex items-center gap-2">
      <Image
        src={user.avatarUrl || DEFAULT_AVATAR}
        alt={user.nickname}
        width={32}
        height={32}
        // Hidden from the tablet width down, as the live site does: at 18rem
        // the sidebar has no room for it and the input is what the viewer came
        // for. The avatar is decorative here — the viewer knows who they are.
        className="h-8 w-8 flex-none rounded-full object-cover tt-1024:hidden"
      />

      {/*
        `min-w-0`: the input's own min-width:0 lets the input shrink, but this
        field is itself a flex item whose automatic minimum is its content's —
        which still counts the input's default 20-character width. Without it
        the bar is 342px wide inside a 256px panel at tablet widths, and the
        emoji/@/send controls sit outside the sidebar, clipped and unclickable.
      */}
      <div className="flex h-[42px] min-w-0 flex-1 items-center gap-1 rounded-[22px] bg-[var(--tt-field)] px-2">
        <input
          ref={ref}
          value={value}
          maxLength={COMMENT_MAX_LENGTH}
          onChange={(event) => {
            setValue(event.target.value);
            syncMention(event.target.value, event.target.selectionStart);
            if (event.target.value.length < COMMENT_MAX_LENGTH) setLimitHit(false);
          }}
          onSelect={(event) =>
            syncMention(event.currentTarget.value, event.currentTarget.selectionStart)
          }
          onKeyDown={(event) => {
            /* At the cap, a printable keystroke with no selection to replace is
               silently dropped by `maxLength` — surface it as a small hint. */
            const el = event.currentTarget;
            if (
              el.value.length >= COMMENT_MAX_LENGTH &&
              el.selectionStart === el.selectionEnd &&
              event.key.length === 1 &&
              !event.ctrlKey &&
              !event.metaKey &&
              !event.altKey
            ) {
              setLimitHit(true);
            }

            /* While the mention list is up it owns the arrows and Enter. */
            if (mentionOpen) {
              if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                const step = event.key === "ArrowDown" ? 1 : mentionResults.length - 1;
                setMentionIndex((i) => (i + step) % mentionResults.length);
                return;
              }
              if (event.key === "Enter") {
                event.preventDefault();
                applyMention(mentionResults[mentionIndex]);
                return;
              }
              if (event.key === "Escape") {
                setMention(null);
                return;
              }
            }
            if (event.key === "Enter") submit();
            if (event.key === "Escape") {
              if (emojiOpen) setEmojiOpen(false);
              else if (replyTo) onCancelReply();
            }
          }}
          placeholder={
            replyTo ? `Reply to @${replyTo.username}...` : "Add comment..."
          }
          aria-label={
            replyTo ? `Reply to ${replyTo.username}` : "Add comment"
          }
          className="min-w-0 flex-1 bg-transparent px-1 text-[14px] text-[var(--tt-text)] outline-none placeholder:text-[var(--tt-placeholder)]"
        />
        <div className="relative flex-none">
          <button
            type="button"
            aria-label="Emoji"
            aria-expanded={emojiOpen}
            onClick={() => setEmojiOpen((open) => !open)}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]",
              emojiOpen && "bg-[var(--tt-shape-neutral-3)]",
            )}
          >
            <EmojiIcon className="h-5 w-5" />
          </button>

          {emojiOpen && (
            <div className="no-scrollbar absolute bottom-10 right-0 z-20 max-h-[248px] w-[288px] animate-[tt-comment-in_150ms_ease-out] overflow-y-auto rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] p-2 shadow-lg">
              {COMPOSER_EMOJI_GROUPS.map((group) => (
                <div key={group.label} className="mb-1 last:mb-0">
                  <p className="px-1 pb-1 text-[11px] font-semibold uppercase tracking-wide text-[var(--tt-text-muted)]">
                    {group.label}
                  </p>
                  <div className="grid grid-cols-8 gap-1">
                    {group.emojis.map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => insertAtCaret(emoji)}
                        aria-label={emoji}
                        className="flex h-8 w-8 items-center justify-center rounded-[6px] text-[18px] leading-none transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <button
          type="button"
          aria-label="Mention"
          onClick={() => {
            setEmojiOpen(false);
            // Typing the "@" is what opens the list — `onSelect` fires when the
            // caret lands after it, and the token lookup takes it from there.
            insertAtCaret("@");
          }}
          className="flex h-8 w-8 flex-none items-center justify-center rounded-[8px] p-1 text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <AtIcon className="h-5 w-5" />
        </button>
      </div>

      {mentionOpen && (
        <ul className="no-scrollbar absolute bottom-12 left-10 right-10 z-20 max-h-[240px] animate-[tt-comment-in_150ms_ease-out] overflow-y-auto rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-sheet-3)] py-1 shadow-lg">
          {mentionResults.map((profile, index) => (
            <li key={profile.userId}>
              <button
                type="button"
                onMouseEnter={() => setMentionIndex(index)}
                // The input keeps focus, so the caret is still there to write into.
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => applyMention(profile)}
                className={cn(
                  "flex w-full items-center gap-2 px-3 py-1.5 text-left transition-colors",
                  index === mentionIndex && "bg-[var(--tt-shape-neutral-3)]",
                )}
              >
                <Image
                  src={profile.avatarUrl ?? DEFAULT_AVATAR}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 flex-none rounded-full object-cover"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold text-[var(--tt-text)]">
                    {profile.displayName ?? `user${profile.userId}`}
                  </span>
                  <span className="block truncate text-[12px] text-[var(--tt-text-secondary)]">
                    @{mentionHandle(profile)}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

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
