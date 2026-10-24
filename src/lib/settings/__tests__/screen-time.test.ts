import { describe, expect, it } from "vitest";

import {
  addHours,
  axisTicks,
  axisTop,
  formatClockTime,
  formatDuration,
  isLocked,
  lastFourWeeks,
  localDate,
  sleepReminderDue,
  weekStartOf,
} from "@/lib/settings/screen-time";

describe("screen time helpers", () => {
  it("finds the local Monday of a week", () => {
    expect(weekStartOf(new Date(2026, 9, 25, 23))).toBe("2026-10-19"); // Sunday → previous Monday
    expect(weekStartOf(new Date(2026, 9, 19, 0, 5))).toBe("2026-10-19");
  });

  it("offers the last four weeks, oldest first and the current one last, as the live page does", () => {
    const weeks = lastFourWeeks(new Date(2026, 9, 21));

    expect(weeks.map((w) => w.start)).toEqual([
      "2026-09-28",
      "2026-10-05",
      "2026-10-12",
      "2026-10-19",
    ]);
    expect(weeks[0].label).toBe("Sep 28, 2026-Oct 4, 2026");
    expect(weeks.at(-1)?.label).toBe("Oct 19, 2026-Oct 25, 2026");
  });

  it("steps the axis in round numbers of seconds and labels it in minutes", () => {
    expect(axisTicks(1200)).toEqual([20, 16.7, 13.3, 10, 6.7, 3.3]);
    // Both measured on the live chart: a 5.6-minute day, and a 30-second one.
    expect(axisTicks(336)).toEqual([5.8, 5, 4.2, 3.3, 2.5, 1.7, 0.8]);
    expect(axisTicks(30)).toEqual([0.5, 0.4, 0.3, 0.3, 0.2, 0.1]);
    expect(axisTicks(0)).toEqual([0, 0, 0, 0, 0, 0]);
    expect(axisTop(336)).toBe(350);
  });

  it("formats a duration in whole minutes", () => {
    expect(formatDuration(3900)).toBe("1h 5m");
    expect(formatDuration(720)).toBe("12m");
    expect(formatDuration(0)).toBe("0m");
    expect(formatDuration(30)).toBe("1m");
  });
});

describe("isLocked", () => {
  const base = {
    todaySeconds: 600,
    limitMinutes: 10,
    hasPasscode: true,
    unlockedDate: null,
    today: "2026-10-24",
    pathname: "/",
  };

  it("locks once today's time reaches the limit", () => {
    expect(isLocked(base)).toBe(true);
    expect(isLocked({ ...base, todaySeconds: 599 })).toBe(false);
  });

  it("leaves Settings open, so the limit can still be changed", () => {
    expect(isLocked({ ...base, pathname: "/setting" })).toBe(false);
  });

  it("never locks without a limit or a passcode, or once unlocked today", () => {
    expect(isLocked({ ...base, limitMinutes: null })).toBe(false);
    expect(isLocked({ ...base, hasPasscode: false })).toBe(false);
    expect(isLocked({ ...base, unlockedDate: "2026-10-24" })).toBe(false);
    expect(isLocked({ ...base, unlockedDate: "2026-10-23" })).toBe(true);
  });
});

describe("localDate", () => {
  it("is the local calendar day", () => {
    expect(localDate(new Date(2026, 9, 24, 23, 59))).toBe("2026-10-24");
  });
});

describe("sleep hours", () => {
  /** 24 October 2026 at `time`, local. */
  const at = (time: string) => {
    const [hours, minutes] = time.split(":").map(Number);
    return new Date(2026, 9, 24, hours, minutes);
  };

  it("ends eight hours after the start, across midnight", () => {
    expect(addHours("23:30", 8)).toBe("07:30");
    expect(addHours("10:05", 8)).toBe("18:05");
  });

  it("writes a time the way the live fields do", () => {
    expect(formatClockTime("22:00")).toBe("10:00 PM");
    expect(formatClockTime("06:00")).toBe("06:00 AM");
    expect(formatClockTime("00:30")).toBe("12:30 AM");
    expect(formatClockTime("12:15")).toBe("12:15 PM");
  });

  it("is due ten minutes before the start, and at the start", () => {
    expect(sleepReminderDue("22:00", at("21:49"))).toBeNull();
    expect(sleepReminderDue("22:00", at("21:50"))?.kind).toBe("soon");
    expect(sleepReminderDue("22:00", at("22:00"))?.kind).toBe("started");
    expect(sleepReminderDue("22:00", at("22:09"))?.kind).toBe("started");
    expect(sleepReminderDue("22:00", at("22:15"))).toBeNull();
  });

  it("names the night by the day its start falls on", () => {
    expect(sleepReminderDue("00:05", at("23:55"))).toEqual({ kind: "soon", night: "2026-10-25" });
    expect(sleepReminderDue("23:58", new Date(2026, 9, 25, 0, 2))).toEqual({
      kind: "started",
      night: "2026-10-24",
    });
  });
});
