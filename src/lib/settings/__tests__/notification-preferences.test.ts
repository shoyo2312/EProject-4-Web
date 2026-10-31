import { describe, expect, it } from "vitest";

import { inAppAllowed, pushAllowed } from "@/lib/settings/notification-preferences";
import { DEFAULT_SETTINGS as defaults } from "@/lib/settings/__tests__/user-settings-fixture";

/** A wall-clock moment on an ordinary day, in the test machine's own zone. */
const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 9, 24, hours, minutes);
};
const noon = at("12:00");

describe("pushAllowed / inAppAllowed", () => {
  it("maps each type to its switch", () => {
    const s = { ...defaults, pushLikes: false, inAppReposts: false };
    expect(pushAllowed(s, "COMMENT_LIKE", noon)).toBe(false);
    expect(pushAllowed(s, "SHARE", noon)).toBe(true);
    expect(inAppAllowed(s, "REPOST")).toBe(false);
    expect(inAppAllowed(defaults, "SCREEN_TIME")).toBe(false);
  });

  it("mutes push inside sleep hours across midnight", () => {
    const s = { ...defaults, sleepHoursStart: "23:30" };
    expect(pushAllowed(s, "LIKE", at("02:00"))).toBe(false);
    expect(pushAllowed(s, "LIKE", at("08:00"))).toBe(true);
  });

  it("never pushes a weekly screen time update", () => {
    expect(pushAllowed(defaults, "SCREEN_TIME", noon)).toBe(false);
  });

  it("lets everything but a weekly update through before the settings are known", () => {
    expect(pushAllowed(null, "LIKE", noon)).toBe(true);
    expect(inAppAllowed(null, "COMMENT")).toBe(true);
    expect(inAppAllowed(null, "SCREEN_TIME")).toBe(false);
  });
});
