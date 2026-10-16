import { describe, expect, it } from "vitest";

import { strongPasswordField } from "@/lib/forms/schemas";

import { meetsPasswordRules, passwordRules } from "../password-rules";

describe("passwordRules", () => {
  it("ticks nothing for an empty password", () => {
    expect(passwordRules("").map((rule) => rule.met)).toEqual([false, false, false]);
  });

  it("ticks each rule independently", () => {
    expect(passwordRules("abcdefgh").map((rule) => rule.met)).toEqual([
      true,
      false,
      false,
    ]);
    expect(passwordRules("aB1!").map((rule) => rule.met)).toEqual([
      false,
      true,
      true,
    ]);
  });

  it("rejects a password over 100 characters", () => {
    expect(passwordRules(`aB1!${"x".repeat(97)}`)[0].met).toBe(false);
  });

  it("agrees with the schema the server's limits are mirrored in", () => {
    for (const value of ["", "short", "alllowercase1!", "NoDigits!!", "Valid1!pass", "aB1!"]) {
      expect(meetsPasswordRules(value)).toBe(strongPasswordField.safeParse(value).success);
    }
  });
});
