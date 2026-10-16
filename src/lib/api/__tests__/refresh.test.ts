import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { refreshAccessToken } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { getAccessToken, getRefreshToken, storeTokens } from "@/lib/api/tokens";

const fetchMock = vi.fn();

function reply(status: number, body = ""): Response {
  return new Response(body || null, { status });
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  storeTokens({ accessToken: "old-access", refreshToken: "old-refresh" });
});

afterEach(() => {
  fetchMock.mockReset();
  vi.unstubAllGlobals();
  window.localStorage.clear();
});

describe("refreshAccessToken", () => {
  it("stores and returns the rotated pair", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        JSON.stringify({
          success: true,
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      ),
    );

    await expect(refreshAccessToken()).resolves.toBe("new-access");
    expect(getAccessToken()).toBe("new-access");
    expect(getRefreshToken()).toBe("new-refresh");
  });

  it.each([400, 401, 403])("ends the session when the token is refused (%i)", async (status) => {
    fetchMock.mockResolvedValue(reply(status));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it.each([429, 502, 503])("keeps the session through a gateway failure (%i)", async (status) => {
    fetchMock.mockResolvedValue(reply(status));

    const error = await refreshAccessToken().catch((cause: unknown) => cause);
    expect(isApiError(error) && error.status).toBe(status);
    expect(getAccessToken()).toBe("old-access");
    expect(getRefreshToken()).toBe("old-refresh");
  });

  it("shares one request between concurrent callers", async () => {
    fetchMock.mockResolvedValue(
      reply(
        200,
        JSON.stringify({
          success: true,
          data: { accessToken: "new-access", refreshToken: "new-refresh" },
        }),
      ),
    );

    await Promise.all([refreshAccessToken(), refreshAccessToken()]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
