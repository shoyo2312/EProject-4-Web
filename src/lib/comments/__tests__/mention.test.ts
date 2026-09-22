import { describe, expect, it } from "vitest";

import { mentionHandle, mentionTokenAt, splitMentions } from "@/lib/comments/mention";

describe("mentionTokenAt", () => {
  it("finds the @word under the caret", () => {
    expect(mentionTokenAt("hi @jo", 6)).toEqual({ start: 3, query: "jo" });
    expect(mentionTokenAt("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("ignores addresses and closed tokens", () => {
    expect(mentionTokenAt("mail@x", 6)).toBeNull();
    expect(mentionTokenAt("@jo done", 8)).toBeNull();
  });
});

describe("mentionHandle", () => {
  it("prefers the username, else squeezes the display name", () => {
    expect(mentionHandle({ userId: "1", username: "jo" } as never)).toBe("jo");
    expect(mentionHandle({ userId: "1", displayName: "Jo Ann" } as never)).toBe("JoAnn");
    expect(mentionHandle({ userId: "7" } as never)).toBe("user7");
  });
});

describe("splitMentions", () => {
  it("marks word-initial @handles only", () => {
    expect(splitMentions("hi @jo, mail@x.com")).toEqual([
      { text: "hi ", mention: false },
      { text: "@jo", mention: true },
      { text: ", mail", mention: false },
      { text: "@x.com", mention: false },
    ]);
  });
});
