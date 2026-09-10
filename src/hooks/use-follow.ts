"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import {
  follow,
  isFollowing,
  peekFollowState,
  setFollowState,
  subscribeFollowState,
  unfollow,
} from "@/lib/api/users";

interface FollowControl {
  /** The author is the viewer. Hide the control: nobody follows themselves. */
  isSelf: boolean;
  following: boolean;
  /**
   * False only while a signed-in viewer's real relationship is still being
   * looked up and the cache had no answer. The button should not paint
   * Follow/Following until this is true, or it flashes the wrong one first.
   */
  ready: boolean;
  toggle: () => void;
}

/**
 * The Follow control on a video, wherever it appears — the rail's badge and the
 * detail page's button both ask the same question about the same account.
 *
 * `authorId` is undefined for mock authors, which have no backend account. Those
 * keep toggling locally, exactly as they did before there was an API to call:
 * the cloned UI still has to demo, and there is nobody to follow.
 *
 * @param initial what the card was rendered with, used until the server answers.
 */
export function useFollow(
  authorId: string | undefined,
  initial = false,
): FollowControl {
  const { user, requireSignIn } = useSession();
  const viewerId = user?.userId;
  const isSelf = authorId !== undefined && authorId === viewerId;

  // Seed from the tab's follow cache when it already knows: a warm cache (the
  // feed walked the following list, or a prior toggle wrote it) means no async
  // correction happens at all, so there is nothing to flash.
  const cached = authorId ? peekFollowState(authorId) : undefined;
  const [following, setFollowing] = useState(cached ?? initial);
  const [answered, setAnswered] = useState(!authorId || cached !== undefined);

  // Signed out there is nothing to ask — every user-service endpoint needs a
  // token — so the button starts on "Follow" and the tap opens the login modal.
  // A warm cache already answered through the state initialisers above; this
  // only runs the following-list walk when it did not.
  useEffect(() => {
    if (answered || !authorId || !viewerId || isSelf) return;

    let cancelled = false;
    isFollowing(viewerId, authorId)
      .then((answer) => {
        if (cancelled) return;
        setFollowing(answer);
        setAnswered(true);
      })
      .catch(() => {
        // Unreadable relationship — settle on "Follow" rather than stay hidden.
        if (!cancelled) setAnswered(true);
      });

    return () => {
      cancelled = true;
    };
  }, [answered, authorId, viewerId, isSelf]);

  // The cache is the tab's single answer, and the same author appears on many
  // videos at once. Without this, the second card keeps the copy it mounted
  // with and only a reload agrees with the button that was actually pressed.
  useEffect(() => {
    if (!authorId) return;

    return subscribeFollowState(() => {
      const answer = peekFollowState(authorId);
      if (answer === undefined) return;
      setFollowing(answer);
      setAnswered(true);
    });
  }, [authorId]);

  const toggle = useCallback(() => {
    if (!requireSignIn()) return;

    const next = !following;
    setFollowing(next);
    if (!authorId) return;

    // Written before the request, not after it: the other cards by this author
    // repaint now, and a card mounting mid-flight seeds from the cache instead
    // of walking the following list the server has not updated yet.
    setFollowState(authorId, next);

    (next ? follow(authorId) : unfollow(authorId)).catch(() => {
      // Silent rollback, matching the like button.
      setFollowState(authorId, !next);
      setFollowing(!next);
    });
  }, [authorId, following, requireSignIn]);

  // Nothing to look up when signed out or on your own / a mock author.
  const ready = isSelf || !authorId || !viewerId || answered;

  return { isSelf, following, ready, toggle };
}
