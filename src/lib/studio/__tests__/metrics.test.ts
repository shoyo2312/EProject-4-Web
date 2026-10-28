import { describe, expect, it } from "vitest";

import {
  changeLine,
  dayLabel,
  dayRangeToInstants,
  formatPercent,
  formatWatchTime,
  labelIndexes,
  linePath,
  niceMax,
} from "@/lib/studio/metrics";

describe("changeLine", () => {
  it("writes the change and its percent with signs", () => {
    expect(changeLine(120, 80)).toBe("+40 (+50.0%)");
    expect(changeLine(60, 80)).toBe("-20 (-25.0%)");
  });

  it("has no percent when there is nothing to compare against", () => {
    expect(changeLine(0, 0)).toBe("0 (--)");
    expect(changeLine(5, 0)).toBe("+5 (--)");
  });

  it("measures a fall from a negative net against its size", () => {
    expect(changeLine(-4, -2)).toBe("-2 (-100.0%)");
  });
});

describe("niceMax", () => {
  it("rounds up to 1, 2 or 5 times a power of ten", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(120)).toBe(200);
    expect(niceMax(4500)).toBe(5000);
    expect(niceMax(1000)).toBe(1000);
  });
});

describe("linePath", () => {
  it("spreads the points over the width with zero at the bottom", () => {
    expect(linePath([0, 10, 5], 100, 50, 10)).toBe("M0 50 L50 0 L100 25");
  });

  it("draws one value as a flat line", () => {
    expect(linePath([5], 100, 50, 10)).toBe("M0 25 L100 25");
  });

  it("keeps a negative day on the axis", () => {
    expect(linePath([-3, 10], 100, 50, 10)).toBe("M0 50 L100 0");
  });
});

describe("labelIndexes", () => {
  it("labels every day of a week", () => {
    expect(labelIndexes(7)).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("keeps both ends of a long window", () => {
    const indexes = labelIndexes(365);
    expect(indexes).toHaveLength(7);
    expect(indexes[0]).toBe(0);
    expect(indexes[6]).toBe(364);
  });
});

describe("dayLabel", () => {
  it("names the day without shifting it through a zone", () => {
    expect(dayLabel("2026-10-17")).toBe("Oct 17");
    expect(dayLabel("2026-01-01")).toBe("Jan 1");
  });
});

describe("formatWatchTime", () => {
  it("reads in seconds, then minutes, then hours", () => {
    expect(formatWatchTime(5400)).toBe("5.4s");
    expect(formatWatchTime(65_000)).toBe("1m 5s");
    expect(formatWatchTime(7_380_000)).toBe("2h 3m");
  });
});

describe("formatPercent", () => {
  it("keeps one decimal at most", () => {
    expect(formatPercent(0.425)).toBe("42.5%");
    expect(formatPercent(1)).toBe("100%");
  });
});

describe("dayRangeToInstants", () => {
  it("runs from the first midnight to the midnight after the last day", () => {
    const first = new Date(2026, 9, 1);
    const last = new Date(2026, 9, 3);

    const { from, to } = dayRangeToInstants(first, last);

    expect(new Date(from!).getTime()).toBe(new Date(2026, 9, 1).getTime());
    expect(new Date(to!).getTime()).toBe(new Date(2026, 9, 4).getTime());
  });

  it("leaves an open end open", () => {
    expect(dayRangeToInstants(null, null)).toEqual({ from: undefined, to: undefined });
  });
});
