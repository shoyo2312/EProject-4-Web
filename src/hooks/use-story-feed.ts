"use client";

import { useCallback, useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { getStoryFeed } from "@/lib/api/stories";
import type { StoryGroup, UserProfileResponse } from "@/lib/api/types";
import { getProfiles } from "@/lib/api/users";
import { markStorySeen } from "@/lib/stories/navigation";

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
 */
export function useStoryFeed(followedIds: readonly string[] | null): StoryFeedState {
  const { user } = useSession();
  const [groups, setGroups] = useState<StoryGroup[]>([]);
  const [profiles, setProfiles] = useState<Record<string, UserProfileResponse>>({});
  const [version, setVersion] = useState(0);

  const ready = Boolean(user) && followedIds !== null;

  useEffect(() => {
    if (!ready || followedIds === null) {
      return;
    }
    let cancelled = false;
    getStoryFeed(followedIds)
      .then(async (loaded) => {
        if (cancelled) return;
        setGroups(loaded);
        const owners = loaded.map((group) => group.userId);
        if (owners.length === 0) return;
        const found = await getProfiles(owners);
        if (cancelled) return;
        setProfiles(Object.fromEntries(found.map((profile) => [profile.userId, profile])));
      })
      // No tray is the whole failure mode: the feed below it still loads.
      .catch(() => {
        if (!cancelled) setGroups([]);
      });
    return () => {
      cancelled = true;
    };
  }, [ready, followedIds, version]);

  const refresh = useCallback(() => setVersion((current) => current + 1), []);
  const markSeen = useCallback(
    (storyId: string) => setGroups((current) => markStorySeen(current, storyId)),
    [],
  );

  return { groups: ready ? groups : [], profiles, refresh, markSeen };
}
