"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { follow, isFollowing, unfollow } from "@/lib/api/users";

interface FollowControl {
  /** The author is the viewer. Hide the control: nobody follows themselves. */
  isSelf: boolean;
  following: boolean;
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

  const [following, setFollowing] = useState(initial);

  // Signed out there is nothing to ask — every user-service endpoint needs a
  // token — so the button starts on "Follow" and the tap opens the login modal.
  useEffect(() => {
    if (!authorId || !viewerId || isSelf) return;
    let cancelled = false;

    isFollowing(viewerId, authorId)
      .then((answer) => {
        if (!cancelled) setFollowing(answer);
      })
      .catch(() => {
        // Unreadable relationship — the button just starts on "Follow".
      });

    return () => {
      cancelled = true;
    };
  }, [authorId, viewerId, isSelf]);

  const toggle = useCallback(() => {
    if (!requireSignIn()) return;

    const next = !following;
    setFollowing(next);
    if (!authorId) return;

    (next ? follow(authorId) : unfollow(authorId)).catch(() => {
      // Silent rollback, matching the like button.
      setFollowing(!next);
    });
  }, [authorId, following, requireSignIn]);

  return { isSelf, following, toggle };
}
