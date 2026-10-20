import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useStoryFeed } from "@/hooks/use-story-feed";
import type { StoryGroup } from "@/lib/api/types";

let user: { userId: string } | null = { userId: "9" };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user }),
}));

const getStoryFeed = vi.fn<(ids: readonly string[]) => Promise<StoryGroup[]>>();
vi.mock("@/lib/api/stories", () => ({
  getStoryFeed: (ids: readonly string[]) => getStoryFeed(ids),
}));
vi.mock("@/lib/api/users", () => ({
  getProfiles: async (ids: string[]) =>
    ids.map((userId) => ({ userId, username: "u" + userId, displayName: null, avatarUrl: null })),
}));

const group: StoryGroup = {
  userId: "2",
  hasUnseen: true,
  stories: [
    {
      id: "s1",
      userId: "2",
      mediaUrl: "https://media/s1",
      mediaType: "IMAGE",
      caption: null,
      visibility: "PUBLIC",
      status: null,
      durationSeconds: null,
      viewCount: null,
      viewedByMe: false,
      createdAt: "2026-10-20T10:00:00Z",
      expiresAt: "2026-10-21T10:00:00Z",
    },
  ],
};

afterEach(() => {
  getStoryFeed.mockReset();
  user = { userId: "9" };
});

describe("useStoryFeed", () => {
  it("asks nothing while signed out", () => {
    user = null;

    const { result } = renderHook(() => useStoryFeed(["2"]));

    expect(getStoryFeed).not.toHaveBeenCalled();
    expect(result.current.groups).toEqual([]);
  });

  it("waits for the follow list before asking", () => {
    renderHook(() => useStoryFeed(null));

    expect(getStoryFeed).not.toHaveBeenCalled();
  });

  it("loads the tray with its owners' profiles", async () => {
    getStoryFeed.mockResolvedValue([group]);

    const { result } = renderHook(() => useStoryFeed(["2"]));

    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    expect(getStoryFeed).toHaveBeenCalledWith(["2"]);
    await waitFor(() => expect(result.current.profiles["2"]?.username).toBe("u2"));
  });

  it("clears a ring once its stories are seen", async () => {
    getStoryFeed.mockResolvedValue([group]);
    const { result } = renderHook(() => useStoryFeed(["2"]));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    act(() => result.current.markSeen("s1"));

    expect(result.current.groups[0].hasUnseen).toBe(false);
    expect(result.current.groups[0].stories[0].viewedByMe).toBe(true);
  });
});
