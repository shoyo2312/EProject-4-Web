import type { NotificationType } from "@/lib/api/notifications";
import type { UserSettingsResponse } from "@/lib/api/types";
import { inSleepHours } from "@/lib/settings/sleep-hours";

/**
 * Push notifications → Interactions / In-app notifications: which switch stands
 * for which kind of notification. Each defaults to on, server and client alike.
 */
export type NotificationSwitchField =
  | "pushLikes"
  | "pushComments"
  | "pushNewFollowers"
  | "inAppLikes"
  | "inAppComments"
  | "inAppNewFollowers"
  | "inAppReposts";

export interface NotificationSwitch {
  label: string;
  field: NotificationSwitchField;
}

/** What may raise a push or a desktop notification. A repost always may, so it has no switch. */
export const PUSH_SWITCHES: NotificationSwitch[] = [
  { label: "Likes", field: "pushLikes" },
  { label: "Comments", field: "pushComments" },
  { label: "New followers", field: "pushNewFollowers" },
];

/** What may raise a banner while the site is open. */
export const IN_APP_SWITCHES: NotificationSwitch[] = [
  { label: "Likes", field: "inAppLikes" },
  { label: "Comments", field: "inAppComments" },
  { label: "New followers", field: "inAppNewFollowers" },
  { label: "Reposts", field: "inAppReposts" },
];

/** The switch a type answers to: "always" has none to answer to, "never" stays in the inbox. */
type Gate = NotificationSwitchField | "always" | "never";

const PUSH_GATES: Record<NotificationType, Gate> = {
  LIKE: "pushLikes",
  COMMENT_LIKE: "pushLikes",
  COMMENT: "pushComments",
  NEW_FOLLOWER: "pushNewFollowers",
  FOLLOW_REQUEST: "pushNewFollowers",
  FOLLOW_REQUEST_ACCEPTED: "pushNewFollowers",
  SHARE: "always",
  STORY: "always",
  SYSTEM: "always",
  REPOST: "always",
  SCREEN_TIME: "never",
};

const IN_APP_GATES: Record<NotificationType, Gate> = {
  LIKE: "inAppLikes",
  COMMENT_LIKE: "inAppLikes",
  COMMENT: "inAppComments",
  NEW_FOLLOWER: "inAppNewFollowers",
  FOLLOW_REQUEST: "inAppNewFollowers",
  FOLLOW_REQUEST_ACCEPTED: "inAppNewFollowers",
  REPOST: "inAppReposts",
  SHARE: "always",
  STORY: "always",
  SYSTEM: "always",
  SCREEN_TIME: "never",
};

function opens(gate: Gate, settings: UserSettingsResponse | null): boolean {
  if (gate === "never") return false;
  // Settings not known yet, or a field an older server does not send: every
  // switch defaults on.
  return gate === "always" || settings?.[gate] !== false;
}

/**
 * Whether a notification of `type` may raise a desktop notification, the web's
 * push. The rule notification-service applies before FCM: the type's switch,
 * then sleep hours, which mute every push.
 */
export function pushAllowed(
  settings: UserSettingsResponse | null,
  type: NotificationType,
  now: Date,
): boolean {
  return (
    opens(PUSH_GATES[type], settings) &&
    !inSleepHours(settings?.sleepHoursStart ?? null, now)
  );
}

/** Whether a notification of `type` may raise a banner on an open tab. */
export function inAppAllowed(
  settings: UserSettingsResponse | null,
  type: NotificationType,
): boolean {
  return opens(IN_APP_GATES[type], settings);
}
