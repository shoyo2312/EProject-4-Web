import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useVideoFeed } from "@/hooks/use-video-feed";
import { getPersonalizedFeed } from "@/lib/api/recommendations";
import type { VideoResponse } from "@/lib/api/types";
import { getFeed, getVideosByIds } from "@/lib/api/videos";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ isSignedIn: true, isLoading: false }),
}));
vi.mock("@/hooks/use-stomp-topic", () => ({ useStompTopic: () => {} }));
vi.mock("@/lib/api/recommendations", () => ({ getPersonalizedFeed: vi.fn() }));
vi.mock("@/lib/api/videos", () => ({
  getFeed: vi.fn(),
  getVideo: vi.fn(),
  getVideosByIds: vi.fn(),
}));
vi.mock("@/lib/api/feed-cards", () => ({
  toFeedCards: vi.fn(async (rows: VideoResponse[]) => rows.map((row) => ({ id: row.id }))),
}));

afterEach(() => vi.resetAllMocks());

it("asks for For You, and pages on when its keywords leave a ranked batch empty", async () => {
  vi.mocked(getPersonalizedFeed).mockResolvedValue([{ videoId: "v1" }] as never);
  vi.mocked(getVideosByIds).mockResolvedValue([]); // every ranked video filtered out
  vi.mocked(getFeed).mockResolvedValue({ items: [{ id: "v2" } as VideoResponse], nextCursor: null });
  const { result } = renderHook(() => useVideoFeed());

  await waitFor(() => expect(result.current.videos).toHaveLength(1));
  expect(getVideosByIds).toHaveBeenCalledWith(["v1"], expect.anything(), "FOR_YOU");
  expect(getFeed).toHaveBeenCalledWith(undefined, 20, expect.anything(), "FOR_YOU");
});
