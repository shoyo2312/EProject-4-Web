import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PostThumb } from "@/components/studio/PostCell";
import { StudioVideoAnalytics } from "@/components/studio/StudioVideoAnalytics";
import type { CreatorVideoDetail, VideoResponse } from "@/lib/api/types";
import { changeLine } from "@/lib/studio/metrics";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/studio/StudioRange", () => ({ useStudioRange: () => ({ days: 7, setDays: vi.fn() }) }));

const getVideo = vi.fn();
vi.mock("@/lib/api/videos", () => ({ getVideo: (...args: unknown[]) => getVideo(...args) }));
vi.mock("@/lib/api/interactions", () => ({
  getVideoCounts: () =>
    Promise.resolve([
      { videoId: "1001", viewCount: 5002, likeCount: 4, commentCount: 3, shareCount: 2, saveCount: 1, repostCount: 0 },
    ]),
}));
const getCreatorVideo = vi.fn();
vi.mock("@/lib/api/studio", () => ({ getCreatorVideo: (...args: unknown[]) => getCreatorVideo(...args) }));

const totals = (views: number, saves: number, newFollowers: number) => ({
  views,
  likes: 0,
  comments: 0,
  shares: 0,
  saves,
  newFollowers,
});

const detail = (patch: Partial<CreatorVideoDetail> = {}): CreatorVideoDetail => ({
  videoId: "1001",
  views: 0,
  viewers: 0,
  totalWatchMs: 0,
  avgWatchMs: 0,
  completionRate: 0,
  likes: 0,
  comments: 0,
  shares: 0,
  saves: 0,
  newFollowers: 0,
  retention: [],
  daily: [],
  current: totals(0, 0, 0),
  previous: totals(0, 0, 0),
  trafficSources: [],
  searchQueries: [],
  audience: {
    total: 0,
    newViewers: 0,
    previousTotal: 0,
    previousNewViewers: 0,
    breakdownAvailable: false,
    returning: null,
    followers: null,
    nonFollowers: null,
    ageGroups: null,
  },
  ...patch,
});

const video = (status: VideoResponse["status"]): VideoResponse => ({
  id: "1001",
  userId: "1",
  title: "A post",
  description: null,
  thumbnailUrl: null,
  hlsUrl: null,
  durationSeconds: 10,
  status,
  visibility: "PUBLIC",
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  commentsDisabled: false,
  accountCommentsOff: false,
  width: null,
  height: null,
  createdAt: "2026-11-01T00:00:00Z",
});

beforeEach(() => {
  getCreatorVideo.mockResolvedValue(detail());
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioVideoAnalytics for a post that is not live", () => {
  it("explains a failed upload instead of charting numbers it can never have", async () => {
    getVideo.mockResolvedValueOnce(video("FAILED"));

    render(<StudioVideoAnalytics videoId="1001" />);

    expect(await screen.findByText(/Transcoding failed/)).toBeTruthy();
    expect(screen.queryByText("Overview")).toBeNull();
  });

  it("says why a post under review has no views yet", async () => {
    getVideo.mockResolvedValueOnce(video("PENDING_REVIEW"));

    render(<StudioVideoAnalytics videoId="1001" />);

    expect(await screen.findByText(/Waiting on a moderator/)).toBeTruthy();
    expect(screen.getByText("Overview")).toBeTruthy();
  });
});

describe("StudioVideoAnalytics layout", () => {
  it("shows lifetime counters by the post and keeps the range picker on Engagement", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));

    render(<StudioVideoAnalytics videoId="1001" />);

    const saves = (await screen.findByText("Saves")).closest("div");
    expect(saves?.textContent).toBe("Saves1");
    expect((await screen.findByText("Views")).closest("div")?.textContent).toBe("Views5002");
    const engagement = screen.getByRole("heading", { name: "Engagement" });
    expect(engagement.parentElement?.textContent).toContain("Last 7 days");
  });
});

describe("StudioVideoAnalytics numbers", () => {
  it("showsFiveOverviewTiles", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(detail({ newFollowers: 1234 }));

    render(<StudioVideoAnalytics videoId="1001" />);

    const tile = (await screen.findByText("New followers")).parentElement;
    expect(tile?.textContent).toContain("1234");
  });

  it("engagementHasSavesWithItsChange", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(
      detail({ current: totals(40, 12, 1), previous: totals(30, 8, 0), daily: [] }),
    );

    render(<StudioVideoAnalytics videoId="1001" />);

    const cell = (await screen.findByRole("button", { name: /^Saves/ })).textContent;
    expect(cell).toContain("12");
    expect(cell).toContain(changeLine(12, 8));
  });

  it("insightNamesTheSecond", async () => {
    getVideo.mockResolvedValueOnce({ ...video("PUBLISHED"), durationSeconds: 30 });
    const retention = Array.from({ length: 21 }, (_, i) => (i < 5 ? 1 - i * 0.02 : 0.3 - i * 0.01));
    getCreatorVideo.mockResolvedValueOnce(detail({ views: 10, retention }));

    render(<StudioVideoAnalytics videoId="1001" />);

    expect(await screen.findByText(/Most viewers stopped watching at 00:07/)).toBeTruthy();
  });

  it("noInsightWithoutViews", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(detail({ views: 0, retention: [1, 0.2, 0.1] }));

    render(<StudioVideoAnalytics videoId="1001" />);

    await screen.findByText("No views yet");
    expect(screen.queryByText(/Most viewers/)).toBeNull();
  });
});

describe("PostThumb", () => {
  // A <span> ignores width and height while inline, so inside a parent that is not flex (the
  // Latest comments row) the cover rendered at the image's own size, 1280×720 for a landscape clip.
  it("is a flex box, so its size holds whatever the parent's display", () => {
    const { container } = render(<PostThumb url="https://cdn.example/t.jpg" className="h-14 w-[42px]" />);

    expect(container.firstElementChild?.className.split(" ")).toEqual(
      expect.arrayContaining(["flex", "items-center", "justify-center", "h-14", "w-[42px]"]),
    );
  });

  it("shows a placeholder icon, not an empty box, when the post has no cover", () => {
    const { container } = render(<PostThumb url={null} className="h-14 w-[42px]" />);

    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("svg")).not.toBeNull();
  });
});
