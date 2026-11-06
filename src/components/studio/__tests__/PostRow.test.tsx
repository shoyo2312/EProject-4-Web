import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { PostRow } from "@/components/studio/posts/PostRow";
import { toast } from "@/components/ui/toast";
import type { VideoResponse } from "@/lib/api/types";
import { deleteVideo, updateVideoVisibility } from "@/lib/api/videos";

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

describe("PostRow privacy", () => {
  it("confirms the new privacy once the server saved it", async () => {
    const video = post(null);
    vi.mocked(updateVideoVisibility).mockResolvedValueOnce({ ...video, visibility: "PRIVATE" });
    renderRow(video);

    fireEvent.click(screen.getByRole("button", { name: /Everyone/ }));
    fireEvent.click(screen.getByRole("button", { name: "Only me" }));

    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Privacy set to Only me"));
  });
});

describe("PostRow for a post that never went live", () => {
  const failed: VideoResponse = { ...post(null), status: "FAILED" };

  it("offers a failed upload nothing but Delete", () => {
    renderRow(failed);

    for (const name of ["Edit", "View analytics", "View comments"]) {
      expect(screen.queryByRole("link", { name })).toBeNull();
    }
    expect(screen.queryByRole("button", { name: /Everyone/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.queryByRole("menuitem", { name: "Pin to top" })).toBeNull();
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeTruthy();
  });

  it("shows a dash, not zero, for numbers a failed upload can never have", () => {
    renderRow(failed);

    expect(screen.getAllByText("–")).toHaveLength(3);
  });

  it("offers Pin only for a published post that is not private, and always offers Unpin", () => {
    for (const video of [
      { ...post(null), status: "PENDING_REVIEW" as const },
      { ...post(null), visibility: "PRIVATE" as const },
    ]) {
      const { unmount } = renderRow(video);
      fireEvent.click(screen.getByRole("button", { name: "More actions" }));
      expect(screen.queryByRole("menuitem", { name: "Pin to top" })).toBeNull();
      unmount();
    }

    renderRow({ ...post(null), visibility: "PRIVATE", pinnedAt: "2026-11-02T00:00:00Z" });
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    expect(screen.getByRole("menuitem", { name: "Unpin" })).toBeTruthy();
  });

  it("keeps every action for a post under review", () => {
    renderRow({ ...post(null), status: "PENDING_REVIEW" });

    expect(screen.getByRole("link", { name: "Edit" })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Everyone/ })).toBeTruthy();
  });
});

describe("PostRow delete", () => {
  it("sends one delete however often Delete is clicked while it runs", async () => {
    vi.mocked(deleteVideo).mockReturnValue(new Promise(() => {}));
    renderRow(post(null));

    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    const confirm = await screen.findByRole("button", { name: "Delete" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(deleteVideo).toHaveBeenCalledTimes(1);
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
  });
});
