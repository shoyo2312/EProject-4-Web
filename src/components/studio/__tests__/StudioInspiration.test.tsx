import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { APPROVAL_SETTLE_MS, creatorsOf, inCategory, StudioInspiration, TRENDING_REFRESH_MS } from "@/components/studio/StudioInspiration";
import type { VideoResponse } from "@/lib/api/types";
import { getOverlayCollection, getOverlayOrigin } from "@/lib/overlay-origin";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
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
vi.mock("@/lib/api/videos", () => ({ getVideosByIds: (...a: unknown[]) => getVideosByIds(...a) }));
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
  it("ranks posts in chart order, marks the saved one, and opens into this grid", async () => {
    getTrending.mockResolvedValue([{ videoId: "1" }, { videoId: "2" }]);
    echoBatch();

    render(<StudioInspiration tab="trending" />);

    const links = await screen.findAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/video/1", "/video/2"]);
    expect(links[0].textContent).toContain("12.5K");
    expect(screen.getByRole("button", { name: "Remove from My inspiration" })).toBeTruthy();

    fireEvent.click(links[0]);
    expect(getOverlayOrigin()).toBe(window.location.pathname);
    expect(getOverlayCollection()).toEqual(["1", "2"]);
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
    expect(screen.queryAllByRole("link").map((link) => link.getAttribute("href"))).toEqual([
      "/@bee",
      "/@bee",
      "/video/2",
    ]);
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
