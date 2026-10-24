import { describe, expect, it } from "vitest";

import {
  axisTicks,
  axisTop,
  formatDuration,
  lastFourWeeks,
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
