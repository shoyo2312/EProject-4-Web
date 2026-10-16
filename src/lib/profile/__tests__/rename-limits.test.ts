import { describe, expect, it } from "vitest";

import { lockedUntil } from "../rename-limits";

describe("lockedUntil", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");

  it("is open when the server names no date", () => {
    expect(lockedUntil(null, now)).toBeNull();
    expect(lockedUntil(undefined, now)).toBeNull();
  });

  it("stays locked until the moment the server named", () => {
    expect(lockedUntil("2026-10-13T12:00:00Z", now)).toEqual(new Date("2026-10-13T12:00:00Z"));
  });

  it("is open from that moment on", () => {
    expect(lockedUntil("2026-10-06T12:00:00Z", now)).toBeNull();
    expect(lockedUntil("2026-10-01T08:30:00Z", now)).toBeNull();
  });

  it("fails open on a value that is not a date", () => {
    expect(lockedUntil("soon", now)).toBeNull();
  });
});
