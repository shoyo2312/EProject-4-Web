"use client";

import { useStompTopic } from "@/hooks/use-stomp-topic";
import type { NotificationType } from "@/lib/api/notifications";

/**
 * One frame on `/user/queue/notifications` — chat-service's `NotificationFanout`
 * relaying what notification-service just stored. Same fields as the REST inbox
 * entry, plus the ids the relay needs; `read` is absent because an entry is
 * unread the moment it is written.
 */
export interface NotificationFrame {
  notificationId: string;
  /**
   * Ids arrive as strings, like every other frame chat-service sends: a Snowflake relayed as a
   * JSON number is rounded by `JSON.parse` (see `lib/api/json`), and an actor id off by its last
   * digits resolves to nobody — which showed up as a notification with no name and no avatar.
   */
  recipientId: string;
  actorId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  referenceId: string | null;
  createdAt: string;
}

/**
 * Subscribes the signed-in viewer to their own notification queue.
 *
 * `/user/**` is rewritten per session by Spring's user-destination resolver, so
 * there is no id in the destination and no way to ask for somebody else's —
 * unlike `useUserRealtime`, which names the profile it watches.
 *
 * Shares the one socket in `stompClient`; chat-service owns it, notification
 * service has none of its own.
 */
export function useNotificationRealtime(
  enabled: boolean,
  onFrame: (frame: NotificationFrame) => void,
) {
  useStompTopic(enabled ? "/user/queue/notifications" : null, onFrame);
}
