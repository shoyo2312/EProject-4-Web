import { describe, expect, it } from "vitest";

import {
  formatScreenTimeLimit,
  formatSleepHours,
  screenTimeChoices,
} from "@/lib/settings/account-settings";

describe("formatScreenTimeLimit", () => {
  it("reads null as off", () => {
    expect(formatScreenTimeLimit(null)).toBe("Off");
  });

  it("shows a set limit in minutes", () => {
    expect(formatScreenTimeLimit(60)).toBe("60 min");
  });
});

describe("screenTimeChoices", () => {
  it("offers off and the presets", () => {
    expect(screenTimeChoices(null)).toEqual([null, 40, 60, 90, 120]);
    expect(screenTimeChoices(90)).toEqual([null, 40, 60, 90, 120]);
  });

  it("slots a limit set elsewhere in by size", () => {
    expect(screenTimeChoices(45)).toEqual([null, 40, 45, 60, 90, 120]);
    expect(screenTimeChoices(300)).toEqual([null, 40, 60, 90, 120, 300]);
  });
});

describe("formatSleepHours", () => {
  it("reads a missing end as off", () => {
    expect(formatSleepHours(null, null)).toBe("Off");
    expect(formatSleepHours("22:00", null)).toBe("Off");
  });

  it("shows a window, including one across midnight", () => {
    expect(formatSleepHours("22:30", "07:00")).toBe("22:30 – 07:00");
  });
});
