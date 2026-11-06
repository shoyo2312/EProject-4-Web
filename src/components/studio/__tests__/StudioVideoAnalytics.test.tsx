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

describe("StudioVideoAnalytics traffic", () => {
  it("listsTrafficSourcesHighestFirstWithTikTokLabels", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(
      detail({
        trafficSources: [
          { source: "SEARCH", views: 10 },
          { source: "FOR_YOU", views: 60 },
          { source: "PROFILE", views: 30 },
        ],
      }),
    );

    render(<StudioVideoAnalytics videoId="1001" />);

    const list = (await screen.findByText("For You")).closest("ul")!;
    const labels = Array.from(list.querySelectorAll("li > span:first-child")).map((el) => el.textContent);
    expect(labels).toEqual(["For You", "Personal profile", "Search"]);
    expect(list.textContent).toContain("60%");
  });

  it("showsTheEmptyStateWithoutSearchTraffic", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));

    render(<StudioVideoAnalytics videoId="1001" />);

    expect(await screen.findByText("No search traffic yet")).toBeTruthy();
  });
});

const audience = (patch: Partial<CreatorVideoDetail["audience"]>): CreatorVideoDetail["audience"] => ({
  ...detail().audience,
  ...patch,
});

describe("StudioVideoAnalytics viewers", () => {
  it("viewersBreakdownIsWithheldBelowTheThreshold", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(detail({ audience: audience({ total: 5, newViewers: 2 }) }));

    render(<StudioVideoAnalytics videoId="1001" />);

    expect(await screen.findByText(/once you have enough viewers to analyze/)).toBeTruthy();
    expect(screen.queryByText("Returning")).toBeNull();
  });

  it("viewersBreakdownShowsAllSevenAgeGroupsInOrder", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(
      detail({
        audience: audience({
          total: 700,
          newViewers: 100,
          breakdownAvailable: true,
          returning: 600,
          followers: 300,
          nonFollowers: 400,
          ageGroups: { "13-17": 100, "18-24": 100, "25-34": 100, "35-44": 100, "45-54": 100, "55+": 100, UNKNOWN: 100 },
        }),
      }),
    );

    render(<StudioVideoAnalytics videoId="1001" />);

    const age = (await screen.findByText("Age")).closest("div")!;
    const labels = Array.from(age.querySelectorAll("li > span:first-child")).map((el) => el.textContent);
    expect(labels).toEqual(["13-17", "18-24", "25-34", "35-44", "45-54", "55+", "Unknown"]);
  });

  it("newAndReturningSplitTheTotal", async () => {
    getVideo.mockResolvedValueOnce(video("PUBLISHED"));
    getCreatorVideo.mockResolvedValueOnce(
      detail({
        audience: audience({
          total: 1800,
          newViewers: 900,
          breakdownAvailable: true,
          returning: 900,
          followers: 1800,
          nonFollowers: 0,
          ageGroups: { "13-17": 0, "18-24": 0, "25-34": 0, "35-44": 0, "45-54": 0, "55+": 0, UNKNOWN: 1800 },
        }),
      }),
    );

    render(<StudioVideoAnalytics videoId="1001" />);

    const card = (await screen.findByText("Viewer type")).closest("div")!;
    expect(card.textContent).toContain("New50%");
    expect(card.textContent).toContain("Returning50%");
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
