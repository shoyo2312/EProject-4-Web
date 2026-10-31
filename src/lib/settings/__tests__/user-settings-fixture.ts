import type { UserSettingsResponse } from "@/lib/api/types";

/** An account that never changed a setting, as `GET /users/me/settings` answers it. */
export const DEFAULT_SETTINGS: UserSettingsResponse = {
  commentAudience: "EVERYONE",
  dmAudience: "EVERYONE",
  screenTimeLimitMinutes: null,
  screenTimeLimitsByDay: null,
  hasScreenTimePasscode: false,
  sleepHoursStart: null,
  sleepHoursEnd: null,
  weeklyScreenTimeDigest: true,
  privateAccount: false,
  filterSpamOffensive: true,
  filterAllComments: false,
  commentKeywords: [],
  pushLikes: true,
  pushComments: true,
  pushNewFollowers: true,
  inAppLikes: true,
  inAppComments: true,
  inAppNewFollowers: true,
  inAppReposts: true,
  timeZone: null,
};
