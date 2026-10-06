import { describe, expect, it } from "vitest";

import { emptyCode, enterDigits } from "../code-digits";

describe("enterDigits", () => {
  it("writes one digit and moves to the next box", () => {
    expect(enterDigits(emptyCode(), 0, "4")).toEqual({
      digits: ["4", "", "", "", "", ""],
      focus: 1,
    });
  });

  it("fills every box from a pasted code", () => {
    expect(enterDigits(emptyCode(), 0, "123456").digits).toEqual([
      "1", "2", "3", "4", "5", "6",
    ]);
  });

  it("keeps the caret on the last box once it is filled", () => {
    expect(enterDigits(emptyCode(), 5, "9").focus).toBe(5);
  });

  it("drops what does not fit, and anything that is not a digit", () => {
    expect(enterDigits(emptyCode(), 4, "1-2-3").digits).toEqual([
      "", "", "", "", "1", "2",
    ]);
  });

  it("replaces the old digit when typing into a filled box", () => {
    const digits = ["3", "", "", "", "", ""];
    expect(enterDigits(digits, 0, "35").digits[0]).toBe("5");
    expect(enterDigits(digits, 0, "53").digits[0]).toBe("5");
  });

  it("clears only the box that was emptied", () => {
    expect(enterDigits(["1", "2", "3", "", "", ""], 1, "")).toEqual({
      digits: ["1", "", "3", "", "", ""],
      focus: 1,
    });
  });

  it("ignores input with no digits in it", () => {
    expect(enterDigits(["1", "", "", "", "", ""], 1, "a").digits).toEqual([
      "1", "", "", "", "", "",
    ]);
  });
});
