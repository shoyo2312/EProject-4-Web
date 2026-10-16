import { describe, expect, it } from "vitest";

import { maskEmail } from "../mask-email";

describe("maskEmail", () => {
  it("keeps two characters and the domain", () => {
    expect(maskEmail("bao.workspace@gmail.com")).toBe("ba********@gmail.com");
  });

  it("does not reveal the length of a short mailbox", () => {
    expect(maskEmail("a@x.io")).toBe("a********@x.io");
  });

  it("leaves a username alone", () => {
    expect(maskEmail("someone")).toBe("someone");
  });
});
