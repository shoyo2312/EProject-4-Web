import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useFollowFeed } from "@/hooks/use-follow-feed";
import type { VideoResponse } from "@/lib/api/types";
import { getFollowingFeed } from "@/lib/api/videos";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "9" }, isLoading: false }),
}));
vi.mock("@/lib/api/users", () => ({
  getFollowingIds: vi.fn(async () => ["2", "3"]),
  getFriendIds: vi.fn(async () => ["2"]),
}));
vi.mock("@/lib/api/videos", () => ({ getFollowingFeed: vi.fn() }));
vi.mock("@/lib/api/feed-cards", () => ({
  toFeedCards: vi.fn(async (rows: VideoResponse[]) => rows.map((row) => ({ id: row.id }))),
}));

afterEach(() => vi.mocked(getFollowingFeed).mockReset());

const video = (id: string) => ({ id }) as VideoResponse;

it("names the Friends feed, so the viewer's keywords for it apply", async () => {
  vi.mocked(getFollowingFeed).mockResolvedValue({ items: [video("v1")], nextCursor: null });
  const { result } = renderHook(() => useFollowFeed("friends"));

  await waitFor(() => expect(result.current.videos).toHaveLength(1));
  expect(getFollowingFeed).toHaveBeenCalledWith(["2"], undefined, 20, expect.anything(), "FRIENDS");
});

it("pages past a page the viewer's keywords emptied", async () => {
  vi.mocked(getFollowingFeed)
    .mockResolvedValueOnce({ items: [], nextCursor: "c1" })
    .mockResolvedValueOnce({ items: [video("v1")], nextCursor: null });
  const { result } = renderHook(() => useFollowFeed("following"));

  await waitFor(() => expect(result.current.videos).toHaveLength(1));
  expect(getFollowingFeed).toHaveBeenNthCalledWith(
    2,
    ["2", "3"],
    "c1",
    20,
    expect.anything(),
    "FOLLOWING",
  );
});
