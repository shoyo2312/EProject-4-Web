"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import {
  follow,
  isFollowing,
  peekFollowState,
  peekRequested,
  setFollowRequested,
  setFollowState,
  subscribeFollowState,
  unfollow,
} from "@/lib/api/users";

interface FollowControl {
  /** The author is the viewer. Hide the control: nobody follows themselves. */
  isSelf: boolean;
  following: boolean;
  /** A request to this private account is waiting on its owner — "Requested". */
  requested: boolean;
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
 * @param initial what the card was rendered with, used until the server answers.
 */
export function useFollow(
  authorId: string,
  initial = false,
): FollowControl {
  const { user, requireSignIn } = useSession();
  const viewerId = user?.userId;
  const isSelf = authorId === viewerId;

  // Seed from the tab's follow cache when it already knows: a warm cache (the
  // feed walked the following list, or a prior toggle wrote it) means no async
  // correction happens at all, so there is nothing to flash.
  const cached = peekFollowState(authorId);
  const [following, setFollowing] = useState(cached ?? initial);
  const [answered, setAnswered] = useState(cached !== undefined);
  const [requested, setRequested] = useState(() => peekRequested(authorId));

  // Signed out there is nothing to ask — the follow state is the viewer's own
  // and needs a token — so the button starts on "Follow" and the tap opens the
  // login modal. A warm cache already answered through the state initialisers
  // above; this only runs the following-list walk when it did not.
  useEffect(() => {
    if (answered || !viewerId || isSelf) return;

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
    return subscribeFollowState(() => {
      setRequested(peekRequested(authorId));
      const answer = peekFollowState(authorId);
      if (answer === undefined) return;
      setFollowing(answer);
      setAnswered(true);
    });
  }, [authorId]);

  const toggle = useCallback(() => {
    if (!requireSignIn()) return;

    // "Requested" is undone the way "Following" is: the same DELETE withdraws it.
    const next = !following && !requested;
    setFollowing(next);
    setRequested(false);

    // Written before the request, not after it: the other cards by this author
    // repaint now, and a card mounting mid-flight seeds from the cache instead
    // of walking the following list the server has not updated yet.
    setFollowState(authorId, next);
    setFollowRequested(authorId, false);

    // A private account answers REQUESTED, and `follow` has already moved the
    // cache — so every card by this author — off "Following" onto "Requested".
    const request = next
      ? follow(authorId).then(({ status }) => {
          if (status === "REQUESTED") toast.success("Follow request sent.");
        })
      : unfollow(authorId);
    request.catch(() => {
      // Silent rollback, matching the like button — except that a request the
      // server says already exists (`ALREADY_REQUESTED`) lands on "Requested".
      const stillRequested = requested || peekRequested(authorId);
      setFollowState(authorId, following);
      setFollowRequested(authorId, stillRequested);
      setFollowing(following);
      setRequested(stillRequested);
    });
  }, [authorId, following, requested, requireSignIn]);

  // Nothing to look up when signed out or on your own account.
  const ready = isSelf || !viewerId || answered;

  return { isSelf, following, requested, ready, toggle };
}
