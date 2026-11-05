import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { useVideoFeed } from "@/hooks/use-video-feed";
import { getPersonalizedFeed } from "@/lib/api/recommendations";
import type { VideoResponse } from "@/lib/api/types";
import { getFeed, getVideo, getVideosByIds } from "@/lib/api/videos";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ isSignedIn: true, isLoading: false }),
}));
/** The `/topic/feed` handler the hook subscribed, to publish a video into it. */
let publish: ((frame: { videoId?: string }) => void) | null = null;
vi.mock("@/hooks/use-stomp-topic", () => ({
  useStompTopic: (_topic: string, handler: (frame: { videoId?: string }) => void) => {
    publish = handler;
  },
}));
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

/** A For You feed already showing one video, v2. */
async function feedShowingOne() {
  vi.mocked(getPersonalizedFeed).mockResolvedValue([] as never);
  vi.mocked(getFeed).mockResolvedValue({ items: [{ id: "v2" } as VideoResponse], nextCursor: null });
  const hook = renderHook(() => useVideoFeed());
  await waitFor(() => expect(hook.result.current.videos).toHaveLength(1));
  return hook;
}

it("leaves a just-published video out of For You when the viewer filtered it", async () => {
  const { result } = await feedShowingOne();
  vi.mocked(getVideosByIds).mockResolvedValue([]); // its title carries a filtered keyword

  await act(async () => publish?.({ videoId: "v9" }));

  expect(getVideosByIds).toHaveBeenCalledWith(["v9"], undefined, "FOR_YOU");
  expect(getVideo).not.toHaveBeenCalled();
  expect(result.current.videos).toHaveLength(1);
});

it("appends a just-published video the filters let through", async () => {
  const { result } = await feedShowingOne();
  vi.mocked(getVideosByIds).mockResolvedValue([
    { id: "v9", status: "PUBLISHED", visibility: "PUBLIC" } as VideoResponse,
  ]);

  await act(async () => publish?.({ videoId: "v9" }));

  await waitFor(() => expect(result.current.videos).toHaveLength(2));
});
