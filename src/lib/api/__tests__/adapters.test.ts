import { describe, expect, it } from "vitest";

import { isBackendHandle, isBackendVideoId } from "@/lib/api/adapters";

describe("isBackendVideoId", () => {
  it("takes video-service's Snowflake ids", () => {
    expect(isBackendVideoId("365050354607333376")).toBe(true);
    expect(isBackendVideoId("7301234567890123456")).toBe(true);
  });

  it("rejects anything that is not a Snowflake, short numbers included", () => {
    for (const id of ["1", "3", "x7", "citylapse~videos~3"]) {
      expect(isBackendVideoId(id)).toBe(false);
    }
    // Why the handle check cannot stand in for it: any run of digits passes.
    expect(isBackendHandle("1")).toBe(true);
  });
});
