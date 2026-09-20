"use client";

import { useCallback, useEffect, useState } from "react";

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
import {
  useNotificationRealtime,
  type NotificationFrame,
} from "@/hooks/useNotificationRealtime";

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

/** A relayed frame, in the shape the inbox list holds. Always unread. */
function fromFrame(frame: NotificationFrame): NotificationResponse {
  return {
    id: frame.notificationId,
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
    markRead,
    markAllRead,
  };
}
