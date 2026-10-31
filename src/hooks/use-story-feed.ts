"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { getStoryFeed } from "@/lib/api/stories";
import type { StoryGroup, UserProfileResponse } from "@/lib/api/types";
import { getProfiles } from "@/lib/api/users";
import { awaitingReview, markStorySeen } from "@/lib/stories/navigation";

/** How often the tray asks again while the viewer's own story waits for its verdict. */
const PENDING_POLL_MS = 10_000;

export interface StoryFeedState {
  groups: StoryGroup[];
  /** Keyed by userId. An owner whose profile cannot be seen is simply absent. */
  profiles: Record<string, UserProfileResponse>;
  refresh: () => void;
  markSeen: (storyId: string) => void;
}

/**
 * The story tray: `GET /stories/feed` for the accounts the viewer follows, plus their profiles for
 * the bubbles. `followedIds` is null until the follow list has been read — the same list the
 * Following feed walks, so it is read once for both. Signed out there is no tray.
 *
 * While one of the viewer's own stories is pending review the tray asks again every few seconds,
 * so "Pending review" turns into the verdict without a reload. `paused` holds that off while the
 * player is open: a refresh re-sorts the groups under the story being watched.
 */
export function useStoryFeed(
  followedIds: readonly string[] | null,
  paused = false,
): StoryFeedState {
  const { user } = useSession();
  const viewerId = user?.userId;
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfileResponse>>({});
  const [version, setVersion] = useState(0);

  const ready = viewerId !== undefined && followedIds !== null;

  useEffect(() => {
    if (!ready || followedIds === null) {
      return;
    }
    let cancelled = false;
    getStoryFeed(followedIds)
      .then((loaded) => {
        if (cancelled) return;
        setGroups(loaded);
        const owners = loaded.map((group) => group.userId);
        if (owners.length === 0) return;
        getProfiles(owners)
          .then((found) => {
            if (!cancelled) setProfiles(Object.fromEntries(found.map((profile) => [profile.userId, profile])));
          })
          // Bubbles without names still open their stories.
          .catch(() => {});
      })
      // No tray is the whole failure mode: the feed below it still loads.
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, followedIds, version]);

  const pending = viewerId !== undefined && awaitingReview(groups, viewerId);
  useEffect(() => {
    if (!pending || paused) return;
    const timer = setTimeout(() => setVersion((current) => current + 1), PENDING_POLL_MS);
    return () => clearTimeout(timer);
  }, [pending, paused, groups]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const markSeen = useCallback(
    (storyId: string) => setGroups((current) => markStorySeen(current, storyId)),
    [],
  );

  return { groups: ready ? groups : [], profiles, refresh, markSeen };
}
