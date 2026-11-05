import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { PostThumb } from "@/components/studio/PostCell";
import { StudioVideoAnalytics } from "@/components/studio/StudioVideoAnalytics";
import type { VideoResponse } from "@/lib/api/types";

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
vi.mock("@/lib/api/studio", () => ({
  getCreatorVideo: () =>
    Promise.resolve({ views: 0, totalWatchMs: 0, avgWatchMs: 0, completionRate: 0, retention: [], daily: [] }),
}));

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
