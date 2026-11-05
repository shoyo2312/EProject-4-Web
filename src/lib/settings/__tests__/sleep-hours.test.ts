import { describe, expect, it } from "vitest";

import { inSleepHours } from "@/lib/settings/sleep-hours";

/** A wall-clock moment on an ordinary day, in the test machine's own zone. */
const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 9, 24, hours, minutes);
};

describe("inSleepHours", () => {
  it("is off without a start", () => {
    expect(inSleepHours(null, at("23:00"))).toBe(false);
  });

  it("runs eight hours from the start, across midnight", () => {
    expect(inSleepHours("22:00", at("21:59"))).toBe(false);
    expect(inSleepHours("22:00", at("22:00"))).toBe(true);
    expect(inSleepHours("22:00", at("00:30"))).toBe(true);
    expect(inSleepHours("22:00", at("05:59"))).toBe(true);
    expect(inSleepHours("22:00", at("06:00"))).toBe(false);
  });

  it("works for a start after midnight", () => {
    expect(inSleepHours("01:30", at("01:29"))).toBe(false);
    expect(inSleepHours("01:30", at("09:29"))).toBe(true);
    expect(inSleepHours("01:30", at("09:30"))).toBe(false);
  });
});
