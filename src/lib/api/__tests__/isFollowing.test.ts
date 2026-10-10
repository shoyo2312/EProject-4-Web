import { afterEach, describe, expect, it, vi } from "vitest";

const apiFetch = vi.fn();
vi.mock("@/lib/api/client", () => ({
  apiFetch: (path: string, options: unknown) => apiFetch(path, options),
}));

/** Two pages of the viewer's following list: accounts 1–2, then 3. */
function followingPages(path: string, options: { query: { page: number } }) {
  if (!path.endsWith("/following")) throw new Error(`unexpected ${path}`);
  const page = options.query.page;
  const ids = page === 0 ? ["1", "2"] : ["3"];
  return Promise.resolve({
    content: ids.map((userId) => ({ userId })),
    page: { number: page, size: 2, totalElements: 3, totalPages: 2 },
  });
}

/** Fresh module per test: the follow cache is module state. */
async function load() {
  vi.resetModules();
  return import("@/lib/api/users");
}

afterEach(() => {
  apiFetch.mockReset();
});

describe("isFollowing", () => {
  it("walks the list once for every caller asking at the same time", async () => {
    apiFetch.mockImplementation(followingPages);
    const { isFollowing } = await load();

    const answers = await Promise.all(
      ["1", "3", "9"].map((userId) => isFollowing("viewer", userId)),
    );

    expect(answers).toEqual([true, true, false]);
    expect(apiFetch).toHaveBeenCalledTimes(2);
  });

  it("answers later questions from the finished walk", async () => {
    apiFetch.mockImplementation(followingPages);
    const { isFollowing, peekFollowState } = await load();

    await isFollowing("viewer", "1");
    await expect(isFollowing("viewer", "7")).resolves.toBe(false);

    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(peekFollowState("7")).toBe(false);
  });

  it("does not cache a guess from a walk cut short", async () => {
    apiFetch.mockImplementation(followingPages);
    const { isFollowing, peekFollowState } = await load();

    await expect(isFollowing("viewer", "7", 1)).resolves.toBe(false);
    expect(peekFollowState("7")).toBeUndefined();
  });

  it("walks again after a failed walk", async () => {
    apiFetch.mockRejectedValueOnce(new Error("down")).mockImplementation(followingPages);
    const { isFollowing } = await load();

    await expect(isFollowing("viewer", "1")).rejects.toThrow("down");
    await expect(isFollowing("viewer", "1")).resolves.toBe(true);
  });

  it("starts over after the cache is cleared", async () => {
    apiFetch.mockImplementation(followingPages);
    const { clearFollowCache, isFollowing } = await load();

    await isFollowing("viewer", "1");
    clearFollowCache();
    await isFollowing("viewer", "1");

    // Two full walks of the two-page list.
    expect(apiFetch).toHaveBeenCalledTimes(4);
  });
});

describe("follow", () => {
  it("does not mark a private account followed when it only took a request", async () => {
    apiFetch.mockResolvedValue({ followerId: "viewer", followingId: "5", status: "REQUESTED" });
    const { follow, peekFollowState } = await load();

    await follow("5");

    expect(peekFollowState("5")).toBe(false);
  });

  it("marks a public account followed", async () => {
    apiFetch.mockResolvedValue({ followerId: "viewer", followingId: "5", status: "FOLLOWING" });
    const { follow, peekFollowState } = await load();

    await follow("5");

    expect(peekFollowState("5")).toBe(true);
  });
});
