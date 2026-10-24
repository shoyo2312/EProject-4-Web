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
