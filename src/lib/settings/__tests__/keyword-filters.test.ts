import { describe, expect, it } from "vitest";

import { feedsLabel, keywordError } from "@/lib/settings/keyword-filters";

describe("keywordError", () => {
  it("takes a word, a hashtag or a phrase", () => {
    expect(keywordError("cat", [])).toBeNull();
    expect(keywordError("#cat", [])).toBeNull();
    expect(keywordError("cat video", [])).toBeNull();
    expect(keywordError("nhà cái", [])).toBeNull();
    expect(keywordError("   ", [])).toBe("Enter a word, hashtag or phrase");
  });

  it("compares a phrase with its spaces folded", () => {
    expect(keywordError("Cat   Video", ["cat video"])).toBe("You've already added this keyword");
  });

  it("allows 200 characters", () => {
    expect(keywordError("a".repeat(200), [])).toBeNull();
    expect(keywordError("a".repeat(201), [])).toBe("Keywords can be up to 200 characters");
  });

  it("counts characters, not UTF-16 units", () => {
    expect(keywordError("😀".repeat(200), [])).toBeNull();
  });

  it("refuses a keyword already added, in any capitalization", () => {
    expect(keywordError("#Cat", ["#cat"])).toBe("You've already added this keyword");
    expect(keywordError("CAT", ["cat"])).toBe("You've already added this keyword");
  });

  it("ignores spaces around the word", () => {
    expect(keywordError("  cat  ", [])).toBeNull();
  });
});

describe("feedsLabel", () => {
  it("names the feeds a keyword is filtered from, in the form's order", () => {
    expect(feedsLabel({ forYou: true, following: false, friends: true })).toBe("For You, Friends");
    expect(feedsLabel({ forYou: false, following: true, friends: false })).toBe("Following");
  });
});
