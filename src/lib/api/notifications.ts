"use client";

import { apiFetch } from "@/lib/api/client";

/**
 * notification-service. Every endpoint is the caller's own inbox — the gateway
 * route carries no id, and the service reads the recipient off the token — so
 * there is no "someone else's notifications" call to make.
 */

/** Mirrors `NotificationType` in notification-service. */
export type NotificationType =
  | "LIKE"
  | "COMMENT"
  | "SHARE"
  | "NEW_FOLLOWER"
  | "SYSTEM";

export interface NotificationResponse {
  id: string;
  /** Who did the thing (liked/commented/shared/followed). Null for SYSTEM. */
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  /**
   * What the notification points at, type-dependent: a videoId for
   * LIKE/COMMENT/SHARE, the follower's userId for NEW_FOLLOWER, null for
   * SYSTEM. Opaque to the service, so the client decides what it means.
   */
  referenceId: string | null;
  read: boolean;
  createdAt: string;
}

/** Newest first, unpaginated — the service returns the whole inbox. */
export function listNotifications(): Promise<NotificationResponse[]> {
  return apiFetch<NotificationResponse[]>("/notifications", {
    auth: "required",
  });
}

export async function getUnreadCount(): Promise<number> {
  const response = await apiFetch<{ unreadCount: number }>(
    "/notifications/unread-count",
    { auth: "required" },
  );
  return response.unreadCount;
}

export function markNotificationRead(notificationId: string): Promise<null> {
  return apiFetch<null>(`/notifications/${notificationId}/read`, {
    method: "PATCH",
    auth: "required",
  });
}

export function markAllNotificationsRead(): Promise<null> {
  return apiFetch<null>("/notifications/read-all", {
    method: "PATCH",
    auth: "required",
  });
}
