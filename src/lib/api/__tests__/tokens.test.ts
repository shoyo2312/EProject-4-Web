import { describe, expect, it } from "vitest";

import { isAccessTokenFresh } from "@/lib/api/tokens";

const NOW = 1_700_000_000_000;

function jwt(payload: object): string {
  const encode = (part: object) =>
    btoa(JSON.stringify(part)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return `${encode({ alg: "HS256" })}.${encode(payload)}.signature`;
}

describe("isAccessTokenFresh", () => {
  it("is fresh well before exp", () => {
    expect(isAccessTokenFresh(jwt({ exp: NOW / 1000 + 600 }), NOW)).toBe(true);
  });

  it("is stale inside the margin and after exp", () => {
    expect(isAccessTokenFresh(jwt({ exp: NOW / 1000 + 10 }), NOW)).toBe(false);
    expect(isAccessTokenFresh(jwt({ exp: NOW / 1000 - 1 }), NOW)).toBe(false);
  });

  it("treats a token it cannot read as fresh", () => {
    expect(isAccessTokenFresh("not-a-jwt", NOW)).toBe(true);
    expect(isAccessTokenFresh(jwt({ sub: "1" }), NOW)).toBe(true);
  });
});
