import { describe, expect, it } from "vitest";
import { withLikeCount, type VideoFrame } from "@/hooks/use-video-realtime";

const frame = (likeCount: number): VideoFrame => ({
  type: "counts",
  videoId: "1",
  likeCount,
  commentCount: 7,
});

describe("withLikeCount", () => {
  it("replaces a frame that predates the like response", () => {
    const next = withLikeCount({ "1": frame(1) }, "1", 2);
    expect(next["1"].likeCount).toBe(2);
    // Every other counter in the frame is left alone.
    expect(next["1"].commentCount).toBe(7);
  });

  it("keeps the same object when there is nothing to correct", () => {
    const frames = { "1": frame(2) };
    expect(withLikeCount(frames, "1", 2)).toBe(frames);
    expect(withLikeCount(frames, "2", 5)).toBe(frames);
  });
});
