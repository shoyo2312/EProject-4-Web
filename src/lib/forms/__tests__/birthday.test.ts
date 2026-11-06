import { describe, expect, it } from "vitest";

import { toIsoBirthDate } from "@/lib/forms/birthday";

describe("toIsoBirthDate", () => {
  it("toIsoBirthDateZeroPads", () => {
    expect(toIsoBirthDate("May", "9", "2001")).toBe("2001-05-09");
    expect(toIsoBirthDate("December", "31", "1999")).toBe("1999-12-31");
  });
});
