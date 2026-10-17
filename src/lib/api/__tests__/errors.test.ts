import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api/client";
import { ApiError, isApiError, isPrivateAccount, messageFor, parseRetryAfter, retryAt } from "@/lib/api/errors";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("parseRetryAfter", () => {
  const now = Date.parse("2026-10-14T00:00:00Z");

  it.each([
    ["3", 3],
    ["1.2", 2],
    ["Wed, 14 Oct 2026 00:01:00 GMT", 60],
    ["Tue, 13 Oct 2026 23:00:00 GMT", 0],
    ["soon", null],
    [null, null],
  ])("reads %j as %j seconds", (header, want) => {
    expect(parseRetryAfter(header, now)).toBe(want);
  });
});

describe("retryAt", () => {
  const now = Date.parse("2026-10-14T00:00:00Z");

  it("puts Retry-After on the clock", () => {
    const error = new ApiError(429, "UPLOAD_RATE_LIMITED", "too many", 90);
    expect(retryAt(error, now)).toEqual(new Date(now + 90_000));
  });

  it("has no time to give without the header", () => {
    expect(retryAt(new ApiError(429, "UPLOAD_RATE_LIMITED", "too many"), now)).toBeNull();
  });
});

describe("apiFetch", () => {
  it("hands a rate limit's Retry-After to the caller", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ success: false, code: "COMMENT_RATE_LIMITED", message: "slow down" }),
          { status: 429, headers: { "Retry-After": "3" } },
        ),
      ),
    );

    const error = await apiFetch("/interactions/videos/1/comments", {
      method: "POST",
      auth: "none",
    }).catch((cause: unknown) => cause);

    expect(isApiError(error) && error.retryAfter).toBe(3);
  });
});

describe("messageFor", () => {
  const fallback = "Couldn’t post your comment. Please try again.";

  it("says what was being attempted when the code has no copy of its own", () => {
    const error = new ApiError(503, "INTERACTION_NOT_RECORDED", "kafka down");
    expect(messageFor(error, fallback)).toBe(fallback);
  });

  it.each([
    [403, "COMMENTING_RESTRICTED"],
    [403, "PRIVATE_ACCOUNT"],
    [429, "UPLOAD_RATE_LIMITED"],
  ])("has copy of its own for a %i %s", (status, code) => {
    const generic = messageFor(new ApiError(status, "SOMETHING_ELSE", "x"));
    expect(messageFor(new ApiError(status, code, "x"))).not.toBe(generic);
  });

  it("prefers a code's own copy over the fallback", () => {
    const error = new ApiError(422, "COMMENT_REJECTED", "guidelines");
    expect(messageFor(error, fallback)).not.toBe(fallback);
    expect(messageFor(error, fallback)).not.toBe(messageFor(new Error("bug")));
  });
});

describe("isPrivateAccount", () => {
  it("recognises the closed grid of a private account", () => {
    expect(isPrivateAccount(new ApiError(403, "PRIVATE_ACCOUNT", "x"))).toBe(true);
  });

  it("is not fooled by another 403 or a plain error", () => {
    expect(isPrivateAccount(new ApiError(403, "NOT_VIDEO_OWNER", "x"))).toBe(false);
    expect(isPrivateAccount(new Error("PRIVATE_ACCOUNT"))).toBe(false);
  });
});
