import { describe, expect, it } from "vitest";

import { codePointLength, fitEdit } from "@/lib/code-points";

describe("codePointLength", () => {
  it("counts an emoji once, where String.length counts it twice", () => {
    expect("🔥".length).toBe(2);
    expect(codePointLength("🔥")).toBe(1);
    expect(codePointLength("hay quá 🔥🔥")).toBe(10);
  });

  it("counts Vietnamese letters once each, composed", () => {
    expect(codePointLength("đẹp")).toBe(3);
  });

  it("is zero for an empty text", () => {
    expect(codePointLength("")).toBe(0);
  });
});

describe("fitEdit", () => {
  it("lets an edit within the cap through as it is", () => {
    expect(fitEdit("🔥🔥", "🔥🔥🔥", 3)).toBe("🔥🔥🔥");
  });

  it("drops a keystroke at the cap", () => {
    expect(fitEdit("abc", "abXc", 3)).toBe("abc");
  });

  it("cuts a paste to the room left, keeping the text around it", () => {
    expect(fitEdit("ac", "a🔥🔥🔥c", 4)).toBe("a🔥🔥c");
  });

  it("makes room from a selection the edit replaced", () => {
    expect(fitEdit("abcd", "aXYZd", 4)).toBe("aXYd");
  });

  it("never stops a deletion, even from a text already past the cap", () => {
    expect(fitEdit("abcdef", "abcde", 3)).toBe("abcde");
  });
});
