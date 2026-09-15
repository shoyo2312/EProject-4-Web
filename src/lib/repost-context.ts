"use client";

import { getRepostContexts } from "@/lib/api/interactions";
import { getFollowingIds } from "@/lib/api/users";
import type { RepostContextResponse } from "@/lib/api/types";

/**
 * Who reposted each video the tab has rendered, for the repost badge.
 *
 * Every surface that renders a video asks for this, so a per-card request would be one round
 * trip per tile. Ids asked for inside the same commit are collected and sent as one batch —
 * the same trade `getLikeStatuses` makes for the feed's hearts — and the answers are kept for
 * the life of the tab, with a subscription so a repost made in the share sheet updates the
 * badge already on screen.
 */

/** interaction-service's own ceiling on one repost-context request. */
const MAX_BATCH = 50;

const cache = new Map<string, RepostContextResponse>();
const listeners = new Set<() => void>();

let queue = new Set<string>();
let flushing: Promise<void> | null = null;
let following: Promise<Set<string>> | null = null;

function notify() {
  for (const listener of listeners) listener();
}

export function subscribeRepostContext(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getRepostContext(videoId: string): RepostContextResponse | undefined {
  return cache.get(videoId);
}

/**
 * Queues one video for the next batch. Nothing is fetched twice, and a batch that fails leaves
 * the id uncached so the next mount retries — a signed-out viewer simply never gets a badge.
 */
export function loadRepostContext(videoId: string): void {
  if (cache.has(videoId) || queue.has(videoId)) return;
  queue.add(videoId);
  if (flushing) return;

  flushing = Promise.resolve().then(async () => {
    const ids = [...queue];
    queue = new Set();
    flushing = null;

    for (let i = 0; i < ids.length; i += MAX_BATCH) {
      try {
        for (const context of await getRepostContexts(ids.slice(i, i + MAX_BATCH))) {
          cache.set(context.videoId, context);
        }
      } catch {
        // No badge rather than a broken card; the ids stay uncached and are retried later.
      }
    }
    notify();
  });
}

/** Applied after the viewer reposts or un-reposts, so every mounted badge follows along. */
export function setRepostedByMe(videoId: string, viewerId: string, reposted: boolean): void {
  const current = cache.get(videoId);
  const others = (current?.reposterIds ?? []).filter((userId) => userId !== viewerId);
  cache.set(videoId, {
    videoId,
    repostedByMe: reposted,
    reposterIds: reposted ? [viewerId, ...others] : others,
  });
  notify();
}

/**
 * The viewer's following set, walked once per tab: the badge names a reposter only when the
 * viewer follows them, and interaction-service has no read into the follow graph to do that
 * filtering server-side.
 */
export function followingIdSet(viewerId: string): Promise<Set<string>> {
  following ??= getFollowingIds(viewerId)
    .then((ids) => new Set(ids))
    .catch(() => new Set<string>());
  return following;
}

/** Called on sign-in/sign-out: both halves are per-viewer. */
export function clearRepostContextCache(): void {
  cache.clear();
  following = null;
  notify();
}
