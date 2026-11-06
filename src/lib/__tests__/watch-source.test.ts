import { describe, expect, it } from "vitest";

import { videoHref, watchSourceFromParams } from "@/lib/watch-source";

describe("watchSourceFromParams", () => {
  it("mapsKnownSrcValues", () => {
    expect(watchSourceFromParams("search")).toBe("SEARCH");
    expect(watchSourceFromParams("profile")).toBe("PROFILE");
    expect(watchSourceFromParams("explore")).toBe("EXPLORE");
    expect(watchSourceFromParams("message")).toBe("MESSAGE");
  });

  it("unknownOrMissingIsDirect", () => {
    expect(watchSourceFromParams(null)).toBe("DIRECT");
    expect(watchSourceFromParams("")).toBe("DIRECT");
    expect(watchSourceFromParams("FOR_YOU")).toBe("DIRECT");
    expect(watchSourceFromParams("constructor")).toBe("DIRECT");
  });
});

describe("videoHref", () => {
  it("videoHrefEncodesTheQuery", () => {
    expect(videoHref("42", "search", "tiny house & garden")).toBe("/video/42?src=search&q=tiny%20house%20%26%20garden");
    expect(videoHref("42", "profile", "ignored")).toBe("/video/42?src=profile");
  });
});
