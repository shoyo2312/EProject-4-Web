import { describe, expect, it } from "vitest";

import { inRange, monthGrid, pickDay } from "@/lib/studio/calendar";

describe("monthGrid", () => {
  it("pads up to the first day's weekday, Sunday first", () => {
    // 1 October 2026 is a Thursday.
    const grid = monthGrid(2026, 9);

    expect(grid.slice(0, 4)).toEqual([null, null, null, null]);
    expect(grid[4]?.getDate()).toBe(1);
    expect(grid.filter(Boolean)).toHaveLength(31);
  });
});

describe("pickDay", () => {
  const oct = (day: number) => new Date(2026, 9, day);

  it("starts, closes, then starts over", () => {
    const first = pickDay(null, null, oct(10));
    expect(first).toEqual({ start: oct(10), end: null });

    const second = pickDay(first.start, first.end, oct(14));
    expect(second).toEqual({ start: oct(10), end: oct(14) });

    expect(pickDay(second.start, second.end, oct(2))).toEqual({ start: oct(2), end: null });
  });

  it("closes a range picked backwards", () => {
    expect(pickDay(oct(10), null, oct(4))).toEqual({ start: oct(4), end: oct(10) });
  });
});

describe("inRange", () => {
  it("is the days strictly between the ends", () => {
    const start = new Date(2026, 9, 1);
    const end = new Date(2026, 9, 3);
    expect(inRange(new Date(2026, 9, 2), start, end)).toBe(true);
    expect(inRange(start, start, end)).toBe(false);
  });
});
