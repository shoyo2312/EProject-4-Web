import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useVideoLike } from "@/hooks/use-video-like";
import type { LikeStatusResponse } from "@/lib/api/types";

let signedIn = true;
const requireSignIn = vi.fn(() => signedIn);
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ requireSignIn }),
}));

const likeVideo = vi.fn<(id: string) => Promise<LikeStatusResponse>>();
const unlikeVideo = vi.fn<(id: string) => Promise<LikeStatusResponse>>();
vi.mock("@/lib/api/interactions", () => ({
  likeVideo: (id: string) => likeVideo(id),
  unlikeVideo: (id: string) => unlikeVideo(id),
}));

const render = (videoId: string, onConfirmed = vi.fn()) =>
  renderHook(() =>
    useVideoLike({ videoId, serverLiked: false, serverCount: 5, onConfirmed }),
  );

beforeEach(() => {
  vi.useFakeTimers();
  signedIn = true;
});

afterEach(() => {
  vi.useRealTimers();
  requireSignIn.mockClear();
  likeVideo.mockReset();
  unlikeVideo.mockReset();
});

describe("useVideoLike", () => {
  it("opens the login modal instead of liking while signed out", () => {
    signedIn = false;
    const { result } = render("1");

    act(() => {
      result.current.toggleLike();
      result.current.likeOnly();
    });

    expect(requireSignIn).toHaveBeenCalledTimes(2);
    expect(result.current.liked).toBe(false);
    expect(result.current.likeCount).toBe(5);
  });

  it("counts the tap at once and hands the reply back", async () => {
    const reply = { videoId: "1", liked: true, likeCount: 9 };
    likeVideo.mockResolvedValue(reply);
    const onConfirmed = vi.fn();
    const { result } = render("1", onConfirmed);

    act(() => result.current.toggleLike());
    expect(result.current.liked).toBe(true);
    expect(result.current.likeCount).toBe(6);

    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(likeVideo).toHaveBeenCalledWith("1");
    expect(onConfirmed).toHaveBeenCalledWith(reply);
  });

  it("never clears the heart on a double tap", () => {
    likeVideo.mockReturnValue(new Promise(() => {}));
    const { result } = render("1");

    act(() => result.current.likeOnly());
    act(() => result.current.likeOnly());

    expect(result.current.liked).toBe(true);
  });

  it("toggles a mock video locally, with nothing to send", async () => {
    const { result } = render("mock-video");

    act(() => result.current.toggleLike());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(result.current.likeCount).toBe(6);
    expect(likeVideo).not.toHaveBeenCalled();
  });
});
