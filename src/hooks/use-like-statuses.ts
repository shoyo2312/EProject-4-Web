"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { getLikeStatuses } from "@/lib/api/interactions";
import type { LikeStatusResponse } from "@/lib/api/types";
import {
  EMPTY_LEDGER,
  confirmLike,
  seedLikes,
  withLikeCount,
  type LikeLedger,
} from "@/lib/likes";

/**
 * Like statuses asked for before the cards that show them exist, by viewer and video. A feed
 * knows its ids a round trip or two before its cards mount (authors and counts come first), so it
 * asks here as soon as it has them and `useLikeStatuses` picks the answer up instead of asking
 * again once the cards are on screen.
 */
const prefetched = new Map<string, Promise<LikeStatusResponse[]>>();
/** How long an answer nobody picked up is kept (the feed dropped those cards, most likely). */
const PREFETCH_KEEP_MS = 60_000;

const prefetchKey = (viewerId: string, videoId: string) => `${viewerId}:${videoId}`;

export function prefetchLikeStatuses(videoIds: readonly string[], viewerId: string): void {
  const fresh = videoIds.filter((videoId) => !prefetched.has(prefetchKey(viewerId, videoId)));
  if (fresh.length === 0) return;

  const batch = getLikeStatuses(fresh);
  const keys = fresh.map((videoId) => prefetchKey(viewerId, videoId));
  for (const key of keys) prefetched.set(key, batch);
  const forget = () => {
    for (const key of keys) if (prefetched.get(key) === batch) prefetched.delete(key);
  };
  batch.then(() => setTimeout(forget, PREFETCH_KEEP_MS), forget);
}

/** The statuses of `videoIds`: what was prefetched for this viewer, and one request for the rest. */
function likeStatusesFor(videoIds: string[], viewerId: string): Promise<LikeStatusResponse[]> {
  const batches = new Set<Promise<LikeStatusResponse[]>>();
  const rest: string[] = [];
  for (const videoId of videoIds) {
    const key = prefetchKey(viewerId, videoId);
    const batch = prefetched.get(key);
    if (batch) {
      batches.add(batch);
      prefetched.delete(key); // one use: a later round asks the server again
    } else {
      rest.push(videoId);
    }
  }
  if (rest.length > 0) batches.add(getLikeStatuses(rest));

  const wanted = new Set(videoIds);
  return Promise.all(batches).then((answers) =>
    answers.flat().filter((status) => wanted.has(status.videoId)),
  );
}

/**
 * The server's side of the hearts on screen — the feed's whole list, or the
 * one video on `/video/[id]`. Each heart's own pending tap lives in
 * `useVideoLike`; this is what it is measured against.
 *
 * Seeds the hearts a returning viewer already filled with one batch request,
 * and only for ids not asked about yet: asking for the whole list on every
 * appended page grew the request by a page each time. Signed out there is
 * nothing to ask — the endpoint needs a token.
 */
export function useLikeStatuses(videoIds: readonly string[], viewerId: string | undefined) {
  const [ledger, setLedger] = useState<LikeLedger>(EMPTY_LEDGER);

  // Hearts are per viewer: whoever signs in next must not inherit them. Counts
  // are public and stay. Adjusted during render rather than in an effect, so
  // no frame paints the previous viewer's hearts under the new one.
  const [ledgerViewerId, setLedgerViewerId] = useState(viewerId);
  if (ledgerViewerId !== viewerId) {
    setLedgerViewerId(viewerId);
    setLedger((current) => ({ ...current, liked: {} }));
  }

  /** Ids whose status was already asked for on behalf of `viewerId`. */
  const asked = useRef<{ viewerId?: string; ids: Set<string> }>({ ids: new Set() });

  useEffect(() => {
    // Signing out starts a round too: the same viewer signing back in has
    // lost their hearts above, and must be asked again.
    if (asked.current.viewerId !== viewerId) {
      asked.current = { viewerId, ids: new Set() };
    }
    if (!viewerId) return;
    const round = asked.current;
    const fresh = videoIds.filter((id) => !round.ids.has(id));
    if (fresh.length === 0) return;
    fresh.forEach((id) => round.ids.add(id));

    // No cleanup-driven cancel: the next page re-runs this effect while the
    // answer is still on its way, and those ids are already marked as asked.
    // What makes an answer stale is the viewer changing, so that is the check.
    likeStatusesFor(fresh, viewerId)
      .then((statuses) => {
        if (asked.current !== round) return;
        setLedger((current) => seedLikes(current, statuses));
      })
      .catch(() => {
        // The call failed — hearts start unfilled, and these ids may be asked again.
        fresh.forEach((id) => round.ids.delete(id));
      });
  }, [videoIds, viewerId]);

  /** A like or unlike reply, handed back by `useVideoLike`. */
  const confirm = useCallback((status: LikeStatusResponse) => {
    setLedger((current) => confirmLike(current, status));
  }, []);

  /** A counts frame's like tally — the realtime subscription belongs to the caller. */
  const syncCount = useCallback((videoId: string, likeCount: number) => {
    setLedger((current) => withLikeCount(current, videoId, likeCount));
  }, []);

  return { liked: ledger.liked, counts: ledger.counts, confirm, syncCount };
}
