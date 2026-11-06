import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { APPROVAL_SETTLE_MS, creatorsOf, inCategory, StudioInspiration, TRENDING_REFRESH_MS } from "@/components/studio/StudioInspiration";
import type { VideoResponse } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
const openVideo = vi.fn();
vi.mock("@/components/studio/StudioVideoModal", async (original) => ({
  ...(await original<typeof import("@/components/studio/StudioVideoModal")>()),
  useOpenStudioVideo: () => openVideo,
}));
const toastCustom = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  toast: { error: vi.fn(), success: vi.fn(), custom: (...a: unknown[]) => toastCustom(...a) },
}));
vi.mock("@/hooks/use-saved-videos", () => ({
  useSavedVideos: () => ({ isSaved: (id: string) => id === "2", wasSaved: () => false, toggleSave: vi.fn() }),
}));

/** The handler StudioInspiration hands `/topic/feed`, so a test can deliver a frame. */
const stomp = vi.hoisted(() => ({ handlers: new Map<string, (frame: unknown) => void>() }));
vi.mock("@/hooks/use-stomp-topic", () => ({
  useStompTopic: (destination: string, onFrame: (frame: unknown) => void) => stomp.handlers.set(destination, onFrame),
}));

const getTrending = vi.fn();
const listSavedVideos = vi.fn();
const getVideosByIds = vi.fn();
const getProfiles = vi.fn();
vi.mock("@/lib/api/recommendations", () => ({ getTrending: (...a: unknown[]) => getTrending(...a) }));
vi.mock("@/lib/api/interactions", () => ({ listSavedVideos: (...a: unknown[]) => listSavedVideos(...a) }));
const getUserVideos = vi.fn();
const getUserVideoStats = vi.fn();
vi.mock("@/lib/api/videos", () => ({
  getVideosByIds: (...a: unknown[]) => getVideosByIds(...a),
  getUserVideos: (...a: unknown[]) => getUserVideos(...a),
  getUserVideoStats: (...a: unknown[]) => getUserVideoStats(...a),
}));
vi.mock("@/hooks/use-follow", () => ({
  useFollow: () => ({ isSelf: false, following: false, requested: false, ready: true, toggle: vi.fn() }),
}));
vi.mock("@/lib/api/users", () => ({ getProfiles: (...a: unknown[]) => getProfiles(...a) }));

const video = (id: string, userId = "u1") =>
  ({ id, userId, title: `Video ${id}`, description: null, thumbnailUrl: null, viewCount: 12_500, likeCount: 3 }) as VideoResponse;

/** The batch answers with whatever ids it was asked for, in that order. */
const echoBatch = () => getVideosByIds.mockImplementation((ids: string[]) => Promise.resolve(ids.map((id) => video(id))));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioInspiration — trending posts", () => {
  it("ranks posts in chart order, marks the saved one, and opens in Studio's player", async () => {
    getTrending.mockResolvedValue([{ videoId: "1" }, { videoId: "2" }]);
    echoBatch();

    render(<StudioInspiration tab="trending" />);

    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/video/1", "/video/2"]);
    expect(links[0].textContent).toContain("12.5K");
    expect(screen.getByRole("button", { name: "Remove from My inspiration" })).toBeTruthy();

    fireEvent.click(links[0]);
    expect(openVideo).toHaveBeenCalledWith("1", ["1", "2"]);
    // A ctrl-click is the browser's: the public page in a new tab.
    fireEvent.click(links[1], { ctrlKey: true });
    expect(openVideo).toHaveBeenCalledTimes(1);
  });

  it("confirms a save with a toast, as TikTok does, and a removal with none", async () => {
    getTrending.mockResolvedValue([{ videoId: "1" }, { videoId: "2" }]);
    echoBatch();
    render(<StudioInspiration tab="trending" />);

    fireEvent.click(await screen.findByRole("button", { name: "Remove from My inspiration" }));
    expect(toastCustom).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Add to My inspiration" }));
    expect(toastCustom).toHaveBeenCalledTimes(1);
    const toastBody = (toastCustom.mock.calls[0][0] as () => React.ReactElement)();
    render(toastBody);
    expect(screen.getByText("Added to “My inspiration”")).toBeTruthy();
  });

  it("hydrates the chart 50 ids at a time, the batch endpoint's cap", async () => {
    getTrending.mockResolvedValue(Array.from({ length: 70 }, (_, i) => ({ videoId: String(i + 1) })));
    echoBatch();

    render(<StudioInspiration tab="trending" />);

    expect(await screen.findAllByRole("link")).toHaveLength(70);
    expect(getVideosByIds.mock.calls.map(([ids]) => (ids as string[]).length)).toEqual([50, 20]);
  });
});

describe("StudioInspiration — trending creators", () => {
  it("ranks creators by their best post and keeps three posts each", () => {
    const chart = [video("1", "a"), video("2", "b"), video("3", "a"), video("4", "a"), video("5", "a")];
    expect(creatorsOf(chart).map((c) => [c.userId, c.videos.map((v) => v.id)])).toEqual([
      ["a", ["1", "3", "4"]],
      ["b", ["2"]],
    ]);
  });

  it("drops a creator the viewer may not see", async () => {
    getTrending.mockResolvedValue([{ videoId: "1" }, { videoId: "2" }]);
    getVideosByIds.mockResolvedValue([video("1", "a"), video("2", "b")]);
    getProfiles.mockResolvedValue([
      { userId: "b", username: "bee", displayName: "Bee", bio: null, avatarUrl: null, followerCount: 2_400_000 },
    ]);

    render(<StudioInspiration tab="trending" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Creators" }));

    expect(await screen.findByText("Bee")).toBeTruthy();
    expect(screen.getByText("2.4M")).toBeTruthy();
    expect(getProfiles).toHaveBeenCalledWith(["a", "b"]);
    expect(screen.queryAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(["/video/2"]);
  });

  it("opens the creator in a popup over Studio instead of leaving for the profile", async () => {
    getTrending.mockResolvedValue([{ videoId: "2" }]);
    getVideosByIds.mockResolvedValue([video("2", "b")]);
    getProfiles.mockResolvedValue([
      { userId: "b", username: "bee", displayName: "Bee", bio: "Buzz", avatarUrl: null, followerCount: 2_400_000, followingCount: 7 },
    ]);
    getUserVideoStats.mockResolvedValue({ userId: "b", videoCount: 2, totalLikes: 980, totalViews: 5 });
    getUserVideos.mockResolvedValue({ content: [video("8", "b"), video("9", "b")], page: { size: 12, number: 0, totalElements: 2, totalPages: 1 } });

    render(<StudioInspiration tab="trending" />);
    fireEvent.click(await screen.findByRole("tab", { name: "Creators" }));
    fireEvent.click(await screen.findByRole("button", { name: "Bee" }));

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Follow" })).toBeTruthy();
    expect(await within(dialog).findByText("980")).toBeTruthy();
    expect(getUserVideos.mock.calls[0][0]).toBe("b");
    await waitFor(() =>
      expect(within(dialog).getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
        "/@bee",
        "/video/8",
        "/video/9",
      ]),
    );

    fireEvent.click(within(dialog).getAllByRole("button", { name: "Close" })[0]);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("StudioInspiration — My inspiration", () => {
  it("shows the empty state when nothing is saved", async () => {
    listSavedVideos.mockResolvedValue({ videoIds: [], nextCursor: null, hasMore: false });
    getVideosByIds.mockResolvedValue([]);

    render(<StudioInspiration tab="mine" />);

    expect(await screen.findByText("No posts yet")).toBeTruthy();
    expect(getTrending).not.toHaveBeenCalled();
  });

  it("loads the next page of saves after the first", async () => {
    listSavedVideos
      .mockResolvedValueOnce({ videoIds: ["1"], nextCursor: "c1", hasMore: true })
      .mockResolvedValueOnce({ videoIds: ["2"], nextCursor: null, hasMore: false });
    echoBatch();

    render(<StudioInspiration tab="mine" />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));

    await waitFor(() => expect(screen.getAllByRole("link")).toHaveLength(2));
    expect(listSavedVideos.mock.calls[1][0]).toBe("c1");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});

describe("StudioInspiration — categories", () => {
  const tagged = (id: string, tags: string[]) => ({ ...video(id), tags }) as VideoResponse;

  it("keeps the chart's posts carrying the category's hashtag, in chart order", () => {
    const chart = [tagged("1", ["food"]), tagged("2", ["cars"]), tagged("3", ["food", "travel"]), video("4")];
    expect(inCategory(chart, "All")).toBe(chart);
    expect(inCategory(chart, "Food").map((v) => v.id)).toEqual(["1", "3"]);
    expect(inCategory(chart, "Art")).toEqual([]);
  });

  it("filters the grid by the chosen chip and ranks within it", async () => {
    getTrending.mockResolvedValue([{ videoId: "1" }, { videoId: "2" }, { videoId: "3" }]);
    getVideosByIds.mockResolvedValue([tagged("1", ["cars"]), tagged("2", ["food"]), tagged("3", ["food"])]);

    render(<StudioInspiration tab="trending" />);
    await screen.findAllByRole("link");

    fireEvent.click(screen.getByRole("button", { name: "Food" }));
    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/video/2", "/video/3"]);
    expect(links[0].textContent).toContain("1");

    fireEvent.click(screen.getByRole("button", { name: "Art" }));
    expect(screen.getByText("Nothing in Art is trending yet")).toBeTruthy();
  });
});

describe("StudioInspiration — refresh", () => {
  it("fetches the chart again each rebuild, so a newly tagged post appears without a reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getTrending.mockResolvedValue([{ videoId: "1" }]);
      getVideosByIds.mockResolvedValueOnce([video("1")]);
      getVideosByIds.mockResolvedValue([{ ...video("1"), tags: ["tech"] } as VideoResponse]);

      render(<StudioInspiration tab="trending" />);
      await screen.findAllByRole("link");
      fireEvent.click(screen.getByRole("button", { name: "Technology" }));
      expect(screen.getByText("Nothing in Technology is trending yet")).toBeTruthy();

      await vi.advanceTimersByTimeAsync(TRENDING_REFRESH_MS);
      await waitFor(() => expect(screen.getAllByRole("link").map((l) => l.getAttribute("href"))).toEqual(["/video/1"]));
      expect(getTrending).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("StudioInspiration — approvals", () => {
  it("fetches the chart again shortly after a video is approved, once for a burst", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getTrending.mockResolvedValue([{ videoId: "1" }]);
      echoBatch();
      render(<StudioInspiration tab="trending" />);
      await screen.findAllByRole("link");
      expect(getTrending).toHaveBeenCalledTimes(1);

      const onFrame = stomp.handlers.get("/topic/feed")!;
      onFrame({ videoId: "7" });
      onFrame({ videoId: "8" });
      await vi.advanceTimersByTimeAsync(APPROVAL_SETTLE_MS - 100);
      expect(getTrending).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(200);
      await waitFor(() => expect(getTrending).toHaveBeenCalledTimes(2));
    } finally {
      vi.useRealTimers();
    }
  });
});
