import { beforeEach, describe, expect, it } from "vitest";

import { getLastWatchedId, markLastWatched } from "@/lib/last-watched";

describe("last-watched", () => {
  beforeEach(() => window.sessionStorage.clear());

  it("has nothing before a video plays", () => {
    expect(getLastWatchedId()).toBeNull();
  });

  it("remembers only the latest video played", () => {
    markLastWatched("1001");
    markLastWatched("1002");
    expect(getLastWatchedId()).toBe("1002");
  });
});
