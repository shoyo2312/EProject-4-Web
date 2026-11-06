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

  it("gives up on a hung refresh so it cannot hold the lock forever, keeping the tokens", async () => {
    const timeout = new AbortController();
    const timeoutSpy = vi.spyOn(AbortSignal, "timeout").mockReturnValue(timeout.signal);
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener("abort", () => reject(init.signal?.reason));
        }),
    );

    const pending = refreshAccessToken().catch((cause: unknown) => cause);
    timeout.abort(new DOMException("timed out", "TimeoutError"));

    const error = await pending;
    expect(isApiError(error) && error.code).toBe("NETWORK_ERROR");
    expect(getRefreshToken()).toBe("old-refresh");
    timeoutSpy.mockRestore();
  });

  it("keeps a pair another tab stored while its own refresh was being refused", async () => {
    fetchMock.mockImplementation(async () => {
      storeTokens({ accessToken: "login-access", refreshToken: "login-refresh" });
      return reply(401);
    });

    await expect(refreshAccessToken()).resolves.toBe("login-access");
    expect(getRefreshToken()).toBe("login-refresh");
  });

  it("does not sign back in when another tab signed out while its refresh was in flight", async () => {
    fetchMock.mockImplementation(async () => {
      window.localStorage.clear();
      return reply(
        200,
        JSON.stringify({
          success: true,
          data: { accessToken: "late-access", refreshToken: "late-refresh" },
        }),
      );
    });

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
  });

  it("turns a non-JSON 200 into an ApiError", async () => {
    fetchMock.mockResolvedValue(reply(200, "<html>proxy page</html>"));

    const error = await refreshAccessToken().catch((cause: unknown) => cause);
    expect(isApiError(error) && error.status).toBe(200);
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

  describe("across tabs", () => {
    afterEach(() => {
      Reflect.deleteProperty(navigator, "locks");
    });

    // Every tab's socket is closed in the same sweep when the shared access token expires, so
    // every tab refreshes at once. The loser used to present the spent token, get a 401, and
    // clear the winner's fresh pair out of the shared storage — signing every tab out.
    it("uses the pair another tab rotated while it waited, instead of presenting the spent one", async () => {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: {
          request: async (_name: string, granted: () => Promise<unknown>) => {
            storeTokens({ accessToken: "tab-a-access", refreshToken: "tab-a-refresh" });
            return granted();
          },
        },
      });
      fetchMock.mockResolvedValue(reply(401));

      await expect(refreshAccessToken()).resolves.toBe("tab-a-access");
      expect(fetchMock).not.toHaveBeenCalled();
      expect(getRefreshToken()).toBe("tab-a-refresh");
    });

    it("refreshes unlocked when the lock API refuses the request", async () => {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: {
          request: () => Promise.reject(new DOMException("denied", "SecurityError")),
        },
      });
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
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("does not refresh twice when the refresh itself fails under the lock", async () => {
      Object.defineProperty(navigator, "locks", {
        configurable: true,
        value: {
          request: async (_name: string, granted: () => Promise<unknown>) => granted(),
        },
      });
      fetchMock.mockResolvedValue(reply(503));

      const error = await refreshAccessToken().catch((cause: unknown) => cause);
      expect(isApiError(error) && error.status).toBe(503);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
