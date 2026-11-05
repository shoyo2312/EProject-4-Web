import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PostRow } from "@/components/studio/posts/PostRow";
import { toast } from "@/components/ui/toast";
import type { VideoResponse } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/videos", () => ({ deleteVideo: vi.fn(), updateVideoPinned: vi.fn(), updateVideoVisibility: vi.fn() }));

const downloadFile = vi.fn();
vi.mock("@/lib/download", () => ({ downloadFile: (...args: unknown[]) => downloadFile(...args) }));

const post = (hlsUrl: string | null): VideoResponse => ({
  id: "1001",
  userId: "1",
  title: "A post",
  description: null,
  thumbnailUrl: null,
  hlsUrl,
  durationSeconds: 10,
  status: "PUBLISHED",
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

const renderRow = (video: VideoResponse) =>
  render(
    <ul>
      <PostRow video={video} onChange={vi.fn()} onDelete={vi.fn()} />
    </ul>,
  );

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("PostRow download", () => {
  it("tells the creator when the download fails", async () => {
    downloadFile.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    renderRow(post("https://media.example/video-media/hls/1001/video.mp4"));

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Download" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
  });

  it("offers no download for an HLS manifest, which is not a file to save", () => {
    renderRow(post("https://media.example/video-media/hls/1001/master.m3u8"));

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));

    expect(screen.queryByRole("menuitem", { name: "Download" })).toBeNull();
  });
});
