"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { CommentRealtimeFrame } from "@/components/feed/comments/types";
import { useCommentRealtime } from "@/hooks/use-comment-realtime";
import { resolveAuthor } from "@/lib/api/authors";
import { listComments } from "@/lib/api/interactions";
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
  refreshFirstPage,
  removeCommentById,
  setCommentLikes,
} from "@/lib/comments/tree";
import { formatRelativeTime } from "@/lib/format";
import type { Comment } from "@/types/tiktok";

/**
 * The thread behind `CommentPanel`: seeded from the cache, loaded once per
 * video, paged on demand and kept live by the video's comment frames. Posting
 * and deleting stay in the panel, and write through `setComments`.
 */
export function useCommentThread({
  videoId,
  commentsDisabled,
}: {
  videoId: string;
  commentsDisabled: boolean;
}) {
  /**
   * The panel is keyed by video id, so every pass over a video in the feed
   * remounts it. Seeding from the cache — synchronously, during the first
   * render — is what makes a revisit paint its comments instead of a skeleton.
   */
  const cached: CommentPage | undefined = peekCommentPage(videoId);
  /**
   * The list, plus the replies a realtime frame delivered before their parent's
   * page — held together so one pure updater can move a reply from one to the
   * other when that page lands.
   */
  const [thread, setThread] = useState<{ comments: Comment[]; pending: PendingReply[] }>(
    () => ({
      comments: cached ? mergeComments([], cached.entries, []).comments : [],
      pending: [],
    }),
  );
  const comments = thread.comments;
  /** Top-level ids the last fetched (or cached) first page put on screen. */
  const pageIds = useRef(new Set(cached?.entries.map((entry) => entry.ui.id)));
  const setComments = useCallback(
    (update: Comment[] | ((current: Comment[]) => Comment[])) =>
      setThread((current) => ({
        ...current,
        comments: typeof update === "function" ? update(current.comments) : update,
      })),
    [],
  );
  const [loading, setLoading] = useState(!cached);
  const [cursor, setCursor] = useState<string | null>(cached?.cursor ?? null);
  const [hasMore, setHasMore] = useState(cached?.hasMore ?? false);
  const [loadingMore, setLoadingMore] = useState(false);

  // Comments load once per video.
  useEffect(() => {
    // Comments off: the backend returns an empty list, so there is nothing to fetch.
    if (commentsDisabled) {
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

    loadFirstCommentPage(videoId, true)
      .then((page) => {
        if (cancelled) return;
        // Read before the swap: React may run the updater later, after it.
        const replaced = pageIds.current;
        pageIds.current = new Set(page.entries.map((entry) => entry.ui.id));
        setThread((current) =>
          refreshFirstPage(current.comments, replaced, page.entries, current.pending),
        );
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
  }, [videoId, commentsDisabled]);

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
        // A parked reply can be deleted before its parent ever loads.
        setThread((current) => ({
          comments: removeCommentById(current.comments, frame.commentId),
          pending: current.pending.filter((reply) => reply.ui.id !== frame.commentId),
        }));
        return;
      }
      // Deduped by id, not by "is this my own comment": the same viewer can
      // have this panel open on two devices (or two tabs), and a userId guard
      // dropped the frame in *every* one of them, not just the tab that
      // posted — see `CommentPanel`'s `postBackendComment`, which resolves
      // the matching race in the other direction by yielding to whichever of
      // the frame or the HTTP response lands first.
      Promise.all([
        resolveAuthor(frame.userId ?? ""),
        frame.replyToUserId ? resolveAuthor(frame.replyToUserId) : Promise.resolve(null),
      ])
        .then(([author, replyToAuthor]) => {
          const ui: Comment = {
            id: frame.commentId,
            author,
            text: frame.content ?? "",
            timestamp: formatRelativeTime(frame.createdAt ?? new Date().toISOString()),
            likes: 0,
            replyToName: replyToAuthor?.nickname,
          };
          const parentId = frame.parentId;
          setThread((current) => {
            // Checks replies too: a reply already attached is not a top-level
            // absence, and re-inserting it would show the same row twice.
            if (hasCommentId(current.comments, ui.id)) return current;
            if (!parentId) return { ...current, comments: [ui, ...current.comments] };
            // Parent not on a loaded page yet — parked, and attached by
            // `mergeComments` as soon as its page arrives.
            if (!current.comments.some((comment) => comment.id === parentId)) {
              if (current.pending.some((reply) => reply.ui.id === ui.id)) return current;
              return { ...current, pending: [...current.pending, { ui, parentId }] };
            }
            return { ...current, comments: addReply(current.comments, parentId, ui) };
          });
          // No count bump here: the counts frame carries the authoritative
          // comment total. Counting the row *and* the poster's optimistic
          // bump made every comment worth +2 on the device that wrote it.
        })
        .catch(() => {
          // Author lookup failed — skip rather than show a comment with no author.
        });
    },
    [videoId, setComments],
  );

  useCommentRealtime(videoId, applyRealtimeFrame);

  const loadMore = useCallback(async () => {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await listComments(videoId, cursor);
      const entries = await toUiComments(page.items);
      setThread((current) => mergeComments(current.comments, entries, current.pending));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore);
    } catch {
      // Stay put — the button is still there to retry.
    } finally {
      setLoadingMore(false);
    }
  }, [videoId, cursor, loadingMore]);

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
  }, [setComments]);

  return { comments, setComments, loading, hasMore, loadingMore, loadMore, appendReplies };
}
