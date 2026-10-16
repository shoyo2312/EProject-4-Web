import { afterEach, describe, expect, it, vi } from "vitest";

import { isAccessTokenFresh, onSessionEnded, storeTokens } from "@/lib/api/tokens";

afterEach(() => {
  window.localStorage.clear();
});

describe("onSessionEnded", () => {
  const otherTab = (key: string | null) =>
    window.dispatchEvent(
      new StorageEvent("storage", { key, newValue: null, storageArea: window.localStorage }),
    );

  it("fires when another tab removes the refresh token", () => {
    const listener = vi.fn();
    const stop = onSessionEnded(listener);

    otherTab("tiktok.refreshToken");
    stop();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("ignores other keys, and a tab that still holds a session", () => {
    const listener = vi.fn();
    const stop = onSessionEnded(listener);

    otherTab("tiktok.accessToken");
    storeTokens({ accessToken: "a", refreshToken: "r" });
    otherTab(null);
    stop();

    expect(listener).not.toHaveBeenCalled();
  });
});

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
