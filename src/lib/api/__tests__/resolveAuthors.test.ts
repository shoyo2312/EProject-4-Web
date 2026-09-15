import { afterEach, describe, expect, it, vi } from "vitest";

import type { UserProfileResponse } from "@/lib/api/types";

const getProfiles = vi.fn();
const getProfile = vi.fn();

vi.mock("@/lib/api/users", () => ({
  MAX_PROFILE_BATCH: 2,
  getProfile: (id: string) => getProfile(id),
  getProfiles: (ids: string[]) => getProfiles(ids),
}));
vi.mock("@/lib/api/tokens", () => ({ hasSession: () => true }));

const profile = (userId: string): UserProfileResponse => ({
  userId,
  username: `u${userId}`,
  displayName: `User ${userId}`,
  bio: null,
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
});

/** Fresh module per test: the author cache is module state. */
async function load() {
  vi.resetModules();
  return import("@/lib/api/authors");
}

afterEach(() => {
  getProfiles.mockReset();
  getProfile.mockReset();
});

describe("resolveAuthors", () => {
  it("de-duplicates and chunks at MAX_PROFILE_BATCH", async () => {
    getProfiles.mockImplementation((ids: string[]) =>
      Promise.resolve(ids.map(profile)),
    );
    const { resolveAuthors } = await load();

    const authors = await resolveAuthors(["1", "2", "3", "1"]);

    expect(getProfiles.mock.calls).toEqual([[["1", "2"]], [["3"]]]);
    expect(authors.size).toBe(3);
    expect(authors.get("2")?.nickname).toBe("User 2");
  });

  it("re-uses the cache, so a second call costs no request", async () => {
    getProfiles.mockResolvedValue([profile("1")]);
    const { resolveAuthors } = await load();

    await resolveAuthors(["1"]);
    await resolveAuthors(["1"]);

    expect(getProfiles).toHaveBeenCalledTimes(1);
  });

  it("placeholders an id the batch dropped, and retries it later", async () => {
    // Id 2 is blocked or gone: user-service omits it rather than failing.
    getProfiles.mockResolvedValueOnce([profile("1")]);
    const { resolveAuthors } = await load();

    const first = await resolveAuthors(["1", "2"]);
    expect(first.get("2")?.nickname).toBe("user2");

    getProfiles.mockResolvedValueOnce([profile("2")]);
    const second = await resolveAuthors(["1", "2"]);
    expect(getProfiles.mock.calls[1]).toEqual([["2"]]);
    expect(second.get("2")?.nickname).toBe("User 2");
  });

  it("does not poison a whole chunk when the batch request fails", async () => {
    getProfiles.mockRejectedValueOnce(new Error("500"));
    const { resolveAuthors } = await load();

    const authors = await resolveAuthors(["1", "2"]);

    expect(authors.get("1")?.nickname).toBe("user1");
    getProfiles.mockResolvedValueOnce([profile("1"), profile("2")]);
    expect((await resolveAuthors(["1", "2"])).get("1")?.nickname).toBe("User 1");
  });
});
