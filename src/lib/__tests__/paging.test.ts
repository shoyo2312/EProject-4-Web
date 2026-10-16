import { describe, expect, it } from "vitest";

import { appendUnique } from "@/lib/paging";

describe("appendUnique", () => {
  it("appends the new page and drops rows already on screen", () => {
    const shown = [{ id: "1" }, { id: "2" }];
    expect(appendUnique(shown, [{ id: "2" }, { id: "3" }])).toEqual([
      { id: "1" },
      { id: "2" },
      { id: "3" },
    ]);
  });
});
