import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn<(path: string, options: unknown) => Promise<unknown>>(() => Promise.resolve({ status: "FOLLOWING" }));
vi.mock("@/lib/api/client", () => ({
  apiFetch: (path: string, options: unknown) => apiFetch(path, options),
}));

async function load() {
  vi.resetModules();
  return import("@/lib/api/users");
}

afterEach(() => apiFetch.mockClear());

describe("follow", () => {
  it("sends the video the follow came from, and no body without one", async () => {
    const users = await load();

    await users.follow("2", "42");
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/users/2/follow",
      expect.objectContaining({ method: "POST", body: { sourceVideoId: "42" } }),
    );

    await users.follow("2");
    expect(apiFetch).toHaveBeenLastCalledWith(
      "/users/2/follow",
      expect.not.objectContaining({ body: expect.anything() }),
    );
  });
});
