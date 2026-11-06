import { afterAll, afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "@/lib/api/client";
import {
  deleteVideo,
  getFeed,
  getFollowingFeed,
  getVideosByIds,
  updateVideoCaption,
  updateVideoCommentsSetting,
  updateVideoPinned,
  updateVideoVisibility,
} from "@/lib/api/videos";
import { onVideoChange } from "@/lib/video-events";

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

describe("video mutations announce the change", () => {
  const changes: unknown[] = [];
  const stop = onVideoChange((change) => changes.push(change));
  afterEach(() => {
    changes.length = 0;
  });
  afterAll(stop);

  it("announces the video each edit returns, so every open list can update without a reload", async () => {
    const saved = { id: "1001", pinnedAt: "2026-11-05T00:00:00Z" };
    vi.mocked(apiFetch).mockResolvedValue(saved);

    await updateVideoPinned("1001", true);
    await updateVideoVisibility("1001", "PRIVATE");
    await updateVideoCaption("1001", { title: "t" });
    await updateVideoCommentsSetting("1001", true);

    expect(changes).toEqual(Array(4).fill({ kind: "updated", video: saved }));
  });

  it("announces a delete", async () => {
    vi.mocked(apiFetch).mockResolvedValueOnce(undefined);

    await deleteVideo("1001");

    expect(changes).toEqual([{ kind: "deleted", videoId: "1001" }]);
  });

  it("announces nothing when the server refuses the edit", async () => {
    vi.mocked(apiFetch).mockRejectedValueOnce(new Error("409"));

    await expect(updateVideoPinned("1001", true)).rejects.toThrow();

    expect(changes).toEqual([]);
  });
});
