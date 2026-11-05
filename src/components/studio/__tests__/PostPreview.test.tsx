import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";

import { PostPreview } from "@/components/studio/edit/PostPreview";
import type { VideoResponse } from "@/lib/api/types";

vi.mock("hls.js", () => ({ default: { isSupported: () => false } }));

const post = (hlsUrl: string): VideoResponse => ({
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

const sources = (hlsUrl: string) => {
  const { container } = render(<PostPreview video={post(hlsUrl)} caption="hi" username="me" avatarUrl={undefined} />);
  return Array.from(container.querySelectorAll("video")).map((video) => video.getAttribute("src"));
};

afterEach(cleanup);

describe("PostPreview video source", () => {
  it("hands a progressive file straight to the element", () => {
    const srcs = sources("https://media.example/video-media/hls/1001/video.mp4");
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.every((src) => src === "https://media.example/video-media/hls/1001/video.mp4")).toBe(true);
  });

  it("leaves an HLS manifest to the HLS hook instead of setting it as src", () => {
    const srcs = sources("https://media.example/video-media/hls/1001/master.m3u8");
    expect(srcs.length).toBeGreaterThan(0);
    expect(srcs.every((src) => src === null)).toBe(true);
  });
});
