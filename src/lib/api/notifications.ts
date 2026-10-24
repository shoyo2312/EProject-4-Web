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
  | "COMMENT_LIKE"
  | "SHARE"
  | "NEW_FOLLOWER"
  | "FOLLOW_REQUEST"
  | "FOLLOW_REQUEST_ACCEPTED"
  | "STORY"
  | "SYSTEM"
  | "REPOST"
  | "SCREEN_TIME";

/**
 * The types whose `referenceId` is an account, not a video: the new follower,
 * the requester, the private account that approved the viewer, and the owner
 * of the story.
 */
export function referencesUser(type: NotificationType): boolean {
  return (
    type === "NEW_FOLLOWER" ||
    type === "FOLLOW_REQUEST" ||
    type === "FOLLOW_REQUEST_ACCEPTED" ||
    type === "STORY"
  );
}

/**
 * The `referenceId` of the `SYSTEM` notice "Your account logged in from a new device"
 * (notification-service `NewDeviceSignInEventConsumer.REFERENCE`). Not a type of its own, because
 * the mobile app fails its inbox on a type it does not know; this is how the web tells it apart
 * and offers the way to secure the account.
 */
export const ACCOUNT_SECURITY_REFERENCE = "account-security";

export interface NotificationResponse {
  id: string;
  /** Who did the thing (liked/commented/shared/followed). Null for SYSTEM. */
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  /**
   * What the notification points at, type-dependent: a videoId for
   * LIKE/COMMENT/COMMENT_LIKE/SHARE, a userId for the three follow types and
   * STORY (see `referencesUser`) — for STORY the story's owner, not a story id —
   * null for SYSTEM. Opaque to the service, so the client decides what it means.
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
