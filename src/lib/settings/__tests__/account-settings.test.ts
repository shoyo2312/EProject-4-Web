import { describe, expect, it } from "vitest";

import {
  DAILY_LIMIT_PRESETS,
  dailyLimitValue,
  formatLimit,
  formatSleepHours,
  todayLimitMinutes,
} from "@/lib/settings/account-settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/__tests__/user-settings-fixture";

/** Wednesday 21 October 2026, at noon. */
const wednesday = new Date(2026, 9, 21, 12);
/** Sunday 25 October 2026, at noon — the last day of a Monday-first week. */
const sunday = new Date(2026, 9, 25, 12);

describe("DAILY_LIMIT_PRESETS", () => {
  it("offers the app's four presets", () => {
    expect(DAILY_LIMIT_PRESETS).toEqual([40, 60, 90, 120]);
  });
});

describe("formatLimit", () => {
  it("reads like the live chips", () => {
    expect(formatLimit(40)).toBe("40m");
    expect(formatLimit(60)).toBe("1h");
    expect(formatLimit(90)).toBe("1h 30m");
    expect(formatLimit(480)).toBe("8h");
  });
});

describe("todayLimitMinutes", () => {
  it("is null with no limit", () => {
    expect(todayLimitMinutes(DEFAULT_SETTINGS, wednesday)).toBeNull();
  });

  it("is the same-every-day limit", () => {
    expect(todayLimitMinutes({ ...DEFAULT_SETTINGS, screenTimeLimitMinutes: 45 }, wednesday)).toBe(45);
  });

  it("picks today's entry from a Monday-first week", () => {
    const perDay = { ...DEFAULT_SETTINGS, screenTimeLimitsByDay: [30, 40, 50, 60, 70, 80, 90] };
    expect(todayLimitMinutes(perDay, wednesday)).toBe(50);
    expect(todayLimitMinutes(perDay, sunday)).toBe(90);
  });
});

describe("dailyLimitValue", () => {
  it("reads Off with no settings or no limit", () => {
    expect(dailyLimitValue(null, wednesday)).toBe("Off");
    expect(dailyLimitValue(DEFAULT_SETTINGS, wednesday)).toBe("Off");
  });

  it("shows today's limit", () => {
    expect(dailyLimitValue({ ...DEFAULT_SETTINGS, screenTimeLimitMinutes: 90 }, wednesday)).toBe(
      "1h 30m",
    );
    expect(
      dailyLimitValue(
        { ...DEFAULT_SETTINGS, screenTimeLimitsByDay: [30, 40, 50, 60, 70, 80, 90] },
        wednesday,
      ),
    ).toBe("50m");
  });
});

describe("formatSleepHours", () => {
  it("reads On or Off, as the live row does", () => {
    expect(formatSleepHours(null)).toBe("Off");
    expect(formatSleepHours("22:30")).toBe("On");
  });
});
