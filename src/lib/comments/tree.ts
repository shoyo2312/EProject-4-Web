import type { CommentEntry } from "@/lib/comment-cache";
import type { Comment } from "@/types/tiktok";

/**
 * Pure helpers over the comment list the panel renders: top-level comments,
 * each carrying at most one level of replies (interaction-service flattens
 * deeper threads onto their top-level ancestor). None of these mutate their
 * input; every one returns a new list so React state can be swapped in place.
 */

/** A reply that arrived before its parent's page — parked until the parent shows up. */
export type PendingReply = { ui: Comment; parentId: string };

/** Sets a comment's like tally wherever it lives — top-level, or nested one reply deep. */
export function setCommentLikes(list: Comment[], id: string, likes: number): Comment[] {
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
export function removeCommentById(list: Comment[], id: string): Comment[] {
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
export function addReply(list: Comment[], parentId: string, reply: Comment): Comment[] {
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
export function hasCommentId(list: Comment[], id: string): boolean {
  return list.some(
    (comment) => comment.id === id || comment.replies?.some((reply) => reply.id === id),
  );
}

/** Swaps an optimistic id for the real one once the server responds — top-level or one reply deep. */
export function remapCommentId(list: Comment[], fromId: string, toId: string): Comment[] {
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
export function mergeComments(
  existing: Comment[],
  incoming: CommentEntry[],
  pending: PendingReply[],
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
