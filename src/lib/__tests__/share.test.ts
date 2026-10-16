import { describe, expect, it } from "vitest";

import { shareIntentUrl } from "@/lib/share";

const LINK = "http://localhost:3000/video/365050354607333376?a=1&b=2";

describe("shareIntentUrl", () => {
  it("puts the link in the service's query string, encoded", () => {
    expect(shareIntentUrl("x", LINK)).toBe(
      `https://x.com/intent/tweet?url=${encodeURIComponent(LINK)}`,
    );
    expect(shareIntentUrl("email", LINK)).toBe(`mailto:?body=${encodeURIComponent(LINK)}`);
  });

  it("has nothing for a target the sheet handles itself", () => {
    expect(shareIntentUrl("copy", LINK)).toBeNull();
    expect(shareIntentUrl("repost", LINK)).toBeNull();
  });
});
