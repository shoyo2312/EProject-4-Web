import { describe, expect, it } from "vitest";

import { reasonLabel, scrollEdges } from "@/lib/suggested-accounts";

describe("reasonLabel", () => {
  it("says why each account is suggested", () => {
    expect(reasonLabel("FOLLOWS_YOU", null)).toBe("Follows you");
    expect(reasonLabel("FOLLOWED_BY", "Ann")).toBe("Followed by Ann");
    expect(reasonLabel("FOLLOWED_BY", null)).toBe("Suggested for you");
    expect(reasonLabel("POPULAR", null)).toBe("Suggested for you");
  });
});

describe("scrollEdges", () => {
  it("knows which ends of the row are reached", () => {
    expect(scrollEdges(0, 1296, 3410)).toEqual({ atStart: true, atEnd: false });
    expect(scrollEdges(324, 1296, 3410)).toEqual({ atStart: false, atEnd: false });
    expect(scrollEdges(2113.5, 1296, 3410)).toEqual({ atStart: false, atEnd: true });
    expect(scrollEdges(0, 1296, 1296)).toEqual({ atStart: true, atEnd: true });
  });
});
