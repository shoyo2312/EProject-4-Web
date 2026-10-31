import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useStoryFeed } from "@/hooks/use-story-feed";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";

let user: { userId: string } | null = { userId: "9" };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user }),
}));

const getStoryFeed = vi.fn<(ids: readonly string[]) => Promise<StoryGroup[]>>();
vi.mock("@/lib/api/stories", () => ({
  getStoryFeed: (ids: readonly string[]) => getStoryFeed(ids),
}));
const getProfiles = vi.fn(async (ids: string[]) =>
  ids.map((userId) => ({ userId, username: "u" + userId, displayName: null, avatarUrl: null })),
);
vi.mock("@/lib/api/users", () => ({
  getProfiles: (ids: string[]) => getProfiles(ids),
}));

// One array for every render, as `useFollowFeed` hands out: a fresh literal per render would be a
// new dependency each time and ask again after every answer.
const followed = ["2"];

const story: StoryResponse = {
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
  myReaction: null,
  reactionCounts: null,
  createdAt: "2026-10-20T10:00:00Z",
  expiresAt: "2026-10-21T10:00:00Z",
};

const group: StoryGroup = { userId: "2", hasUnseen: true, stories: [story] };

const ownPending: StoryGroup = {
  userId: "9",
  hasUnseen: false,
  stories: [{ ...story, id: "own", userId: "9", status: "PENDING_MODERATION", viewCount: 0 }],
};

afterEach(() => {
  vi.useRealTimers();
  getStoryFeed.mockReset();
  getProfiles.mockClear();
  user = { userId: "9" };
});

describe("useStoryFeed", () => {
  it("asks nothing while signed out", () => {
    user = null;

    const { result } = renderHook(() => useStoryFeed(followed));

    expect(getStoryFeed).not.toHaveBeenCalled();
    expect(result.current.groups).toEqual([]);
  });

  it("waits for the follow list before asking", () => {
    renderHook(() => useStoryFeed(null));

    expect(getStoryFeed).not.toHaveBeenCalled();
  });

  it("loads the tray with its owners' profiles", async () => {
    getStoryFeed.mockResolvedValue([group]);

    const { result } = renderHook(() => useStoryFeed(followed));

    await waitFor(() => expect(result.current.groups).toHaveLength(1));
    expect(getStoryFeed).toHaveBeenCalledWith(["2"]);
    expect(getStoryFeed).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(result.current.profiles["2"]?.username).toBe("u2"));
  });

  it("keeps the tray when the profiles cannot be read", async () => {
    getStoryFeed.mockResolvedValue([group]);
    getProfiles.mockRejectedValueOnce(new Error("user-service down"));

    const { result } = renderHook(() => useStoryFeed(followed));

    await waitFor(() => expect(getProfiles).toHaveBeenCalled());
    expect(result.current.groups).toHaveLength(1);
  });

  it("clears a ring once its stories are seen", async () => {
    getStoryFeed.mockResolvedValue([group]);
    const { result } = renderHook(() => useStoryFeed(followed));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    act(() => result.current.markSeen("s1"));

    expect(result.current.groups[0].hasUnseen).toBe(false);
    expect(result.current.groups[0].stories[0].viewedByMe).toBe(true);
  });

  it("asks again while the viewer's own story waits for review", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getStoryFeed.mockResolvedValue([ownPending]);
    const { result } = renderHook(() => useStoryFeed(followed));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(getStoryFeed).toHaveBeenCalledTimes(2);
  });

  it("does not ask again while paused", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getStoryFeed.mockResolvedValue([ownPending]);
    const { result } = renderHook(() => useStoryFeed(followed, true));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(getStoryFeed).toHaveBeenCalledTimes(1);
  });

  it("stops asking once nothing is pending", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    getStoryFeed.mockResolvedValue([group]);
    const { result } = renderHook(() => useStoryFeed(followed));
    await waitFor(() => expect(result.current.groups).toHaveLength(1));

    await act(() => vi.advanceTimersByTimeAsync(10_000));

    expect(getStoryFeed).toHaveBeenCalledTimes(1);
  });
});
