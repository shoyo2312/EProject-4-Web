import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api/client";
import { getFeed, getFollowingFeed, getVideosByIds } from "@/lib/api/videos";

vi.mock("@/lib/api/client", () => ({
  apiFetch: vi.fn(async () => ({ items: [], nextCursor: null })),
}));

afterEach(() => vi.mocked(apiFetch).mockClear());

/** The query of the last call. */
const lastQuery = () => vi.mocked(apiFetch).mock.calls.at(-1)?.[1]?.query ?? {};

describe("the feed a read is for", () => {
  it("sends feed only when asked", async () => {
    await getFeed(undefined, 20, undefined, "FOR_YOU");
    expect(lastQuery()).toMatchObject({ feed: "FOR_YOU" });

    await getFeed(undefined, 20);
    expect(lastQuery()).not.toHaveProperty("feed");
  });

  it("asks the batch for For You only when the ranking is For You's", async () => {
    await getVideosByIds(["1", "2"], undefined, "FOR_YOU");
    expect(lastQuery()).toMatchObject({ ids: "1,2", feed: "FOR_YOU" });

    await getVideosByIds(["1"]);
    expect(lastQuery()).not.toHaveProperty("feed");
  });

  it("names Following or Friends on the follow feed", async () => {
    await getFollowingFeed(["7"], undefined, 20, undefined, "FRIENDS");
    expect(lastQuery()).toMatchObject({ followedUserIds: "7", feed: "FRIENDS" });
  });
});
