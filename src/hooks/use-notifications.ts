"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationResponse,
  type NotificationType,
} from "@/lib/api/notifications";
import { getAccessToken } from "@/lib/api/tokens";
import { getProfiles, MAX_PROFILE_BATCH } from "@/lib/api/users";
import { getVideosByIds } from "@/lib/api/videos";
import type { UserProfileResponse, VideoResponse } from "@/lib/api/types";
import {
  useNotificationRealtime,
  type NotificationFrame,
} from "@/hooks/use-notification-realtime";

/**
 * Filter chips, mapped to the types notification-service actually emits. The
 * live site's "Mentions and tags" chip is gone: nothing produces that event, so
 * the chip could only ever show an empty list.
 */
export const NOTIFICATION_FILTERS = [
  { label: "All activity", types: null },
  { label: "Likes", types: ["LIKE"] },
  { label: "Comments", types: ["COMMENT"] },
  { label: "Followers", types: ["NEW_FOLLOWER"] },
] as const satisfies readonly {
  label: string;
  types: readonly NotificationType[] | null;
}[];

export interface NotificationGroup {
  title: string;
  items: NotificationResponse[];
}

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * "Today" / "Yesterday" / "12 Sep" headings, in the order the inbox arrives
 * (newest first) — the service already sorts, so this only cuts the list where
 * the day changes rather than sorting again.
 *
 * Compared by local calendar day, not by elapsed hours: something posted at
 * 23:50 is "Yesterday" at 00:10, not "Today, 20 minutes ago".
 */
export function groupByDay(
  items: NotificationResponse[],
  now = new Date(),
): NotificationGroup[] {
  const groups: NotificationGroup[] = [];
  for (const item of items) {
    const title = dayLabel(new Date(item.createdAt), now);
    const last = groups[groups.length - 1];
    if (last && last.title === title) last.items.push(item);
    else groups.push({ title, items: [item] });
  }
  return groups;
}

function dayLabel(at: Date, now: Date): string {
  const days = Math.round(
    (startOfDay(now).getTime() - startOfDay(at).getTime()) / DAY_MS,
  );
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Stands in for an actor user-service will not hand over — see the batch effect below. */
function blankProfile(userId: string): UserProfileResponse {
  return {
    userId,
    username: null,
    displayName: null,
    bio: null,
    avatarUrl: null,
    followerCount: 0,
    followingCount: 0,
  };
}

/** A relayed frame, in the shape the inbox list holds. Always unread. */
function fromFrame(frame: NotificationFrame): NotificationResponse {
  return {
    id: frame.notificationId,
    actorId: frame.actorId,
    type: frame.type,
    title: frame.title,
    body: frame.body,
    referenceId: frame.referenceId,
    read: false,
    createdAt: frame.createdAt,
  };
}

export interface NotificationInbox {
  items: NotificationResponse[];
  unreadCount: number;
  /** False until the first inbox fetch settles — the empty state waits on it. */
  loaded: boolean;
  /** Actor avatar/username, keyed by `NotificationResponse.actorId`. Fills in as resolved. */
  actors: Map<string, UserProfileResponse>;
  /**
   * The referenced video, keyed by `NotificationResponse.referenceId`, for LIKE/COMMENT/SHARE
   * only — NEW_FOLLOWER's `referenceId` is a userId, not a videoId, and SYSTEM has none.
   */
  videos: Map<string, VideoResponse>;
  markRead: (notificationId: string) => void;
  markAllRead: () => void;
}

/**
 * The viewer's inbox: the stored list over REST, anything arriving since over
 * the socket.
 *
 * Both are needed. The relay only reaches sessions that are open when the entry
 * is written, so a tab opened afterwards would show nothing; the REST list only
 * reflects the moment it was fetched, so a drawer left open would go stale.
 *
 * Reads are optimistic and not rolled back on failure: the request is a
 * `markRead` that either lands or does not, and re-painting a row as unread
 * under someone who just opened it is worse than a count the next fetch
 * corrects.
 */
export function useNotifications(): NotificationInbox {
  const { user } = useSession();
  const token = user ? getAccessToken() : null;
  const [items, setItems] = useState<NotificationResponse[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [actors, setActors] = useState<Map<string, UserProfileResponse>>(
    () => new Map(),
  );
  const [videos, setVideos] = useState<Map<string, VideoResponse>>(
    () => new Map(),
  );

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    Promise.all([listNotifications(), getUnreadCount()])
      .then(([inbox, unread]) => {
        if (cancelled) return;
        setItems(inbox);
        setUnreadCount(unread);
      })
      .catch(() => {
        // An unreachable inbox leaves the drawer empty rather than breaking the
        // sidebar around it; the next sign-in or reload retries.
      })
      .finally(() => {
        // Set from a callback, never synchronously in the effect body: a
        // setState there cascades an extra render on every mount.
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  // Batch-resolve whichever actors the current list names that a prior batch
  // has not already answered. Runs after every items change rather than only
  // on load, so a realtime frame's actor gets an avatar too.
  const unresolvedActorIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (item.actorId && !actors.has(item.actorId)) ids.add(item.actorId);
    }
    return Array.from(ids);
  }, [items, actors]);

  useEffect(() => {
    if (unresolvedActorIds.length === 0) return;
    let cancelled = false;
    const chunks: string[][] = [];
    for (let i = 0; i < unresolvedActorIds.length; i += MAX_PROFILE_BATCH) {
      chunks.push(unresolvedActorIds.slice(i, i + MAX_PROFILE_BATCH));
    }
    Promise.all(chunks.map((chunk) => getProfiles(chunk)))
      .then((results) => {
        if (cancelled) return;
        setActors((current) => {
          const next = new Map(current);
          for (const profile of results.flat()) next.set(profile.userId, profile);
          // An id the batch answered nothing for is gone or blocked either way, so it is
          // recorded as a blank profile rather than left out: an absent entry reads as "still
          // loading" to the drawer, which would spin forever and ask again on every change.
          for (const id of unresolvedActorIds) {
            if (!next.has(id)) next.set(id, blankProfile(id));
          }
          return next;
        });
      })
      .catch(() => {
        // A profile that never resolves just keeps the fallback avatar/glyph;
        // nothing here needs a retry loop.
      });
    return () => {
      cancelled = true;
    };
  }, [unresolvedActorIds]);

  // Same batching as actors above, keyed by referenceId instead of actorId —
  // only LIKE/COMMENT/SHARE name a video at all.
  const unresolvedVideoIds = useMemo(() => {
    const ids = new Set<string>();
    for (const item of items) {
      if (
        item.referenceId &&
        (item.type === "LIKE" || item.type === "COMMENT" || item.type === "SHARE") &&
        !videos.has(item.referenceId)
      ) {
        ids.add(item.referenceId);
      }
    }
    return Array.from(ids);
  }, [items, videos]);

  useEffect(() => {
    if (unresolvedVideoIds.length === 0) return;
    let cancelled = false;
    const chunks: string[][] = [];
    for (let i = 0; i < unresolvedVideoIds.length; i += MAX_PROFILE_BATCH) {
      chunks.push(unresolvedVideoIds.slice(i, i + MAX_PROFILE_BATCH));
    }
    Promise.all(chunks.map((ids) => getVideosByIds(ids)))
      .then((results) => {
        if (cancelled) return;
        setVideos((current) => {
          const next = new Map(current);
          for (const video of results.flat()) next.set(video.id, video);
          return next;
        });
      })
      .catch(() => {
        // A video that never resolves just leaves the row without a thumbnail.
      });
    return () => {
      cancelled = true;
    };
  }, [unresolvedVideoIds]);

  useNotificationRealtime(
    token,
    useCallback((frame: NotificationFrame) => {
      setItems((current) =>
        // A frame can arrive for an entry the REST list already carried, when a
        // fetch overlaps the relay.
        current.some((item) => item.id === frame.notificationId)
          ? current
          : [fromFrame(frame), ...current],
      );
      setUnreadCount((count) => count + 1);
    }, []),
  );

  const markRead = useCallback(
    (notificationId: string) => {
      // Read off `items` rather than deciding inside the updater: an updater
      // runs at render time, so a flag it sets is still false on the line after
      // the call and the request would never be sent.
      const target = items.find((item) => item.id === notificationId);
      if (!target || target.read) return;

      setItems((current) =>
        current.map((item) =>
          item.id === notificationId ? { ...item, read: true } : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
      markNotificationRead(notificationId).catch(() => {});
    },
    [items],
  );

  const markAllRead = useCallback(() => {
    setItems((current) => current.map((item) => ({ ...item, read: true })));
    setUnreadCount(0);
    markAllNotificationsRead().catch(() => {});
  }, []);

  // Signed out is derived, not cleared in the effect: clearing would be a
  // setState during an effect body (a cascading render), and what is left in
  // state is overwritten by the fetch the next sign-in runs anyway.
  return {
    items: user ? items : [],
    unreadCount: user ? unreadCount : 0,
    loaded,
    actors,
    videos,
    markRead,
    markAllRead,
  };
}
