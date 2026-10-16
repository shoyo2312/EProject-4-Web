import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useLikeStatuses } from "@/hooks/use-like-statuses";
import type { LikeStatusResponse } from "@/lib/api/types";

const getLikeStatuses = vi.fn<(ids: string[]) => Promise<LikeStatusResponse[]>>();
vi.mock("@/lib/api/interactions", () => ({
  getLikeStatuses: (ids: string[]) => getLikeStatuses(ids),
}));

const likedAll = (ids: string[]) =>
  Promise.resolve(ids.map((videoId) => ({ videoId, liked: true, likeCount: 10 })));

const render = (videoIds: string[], viewerId: string | undefined) =>
  renderHook((props) => useLikeStatuses(props.videoIds, props.viewerId), {
    initialProps: { videoIds, viewerId },
  });

afterEach(() => {
  getLikeStatuses.mockReset();
});

describe("useLikeStatuses", () => {
  it("asks nothing while signed out", () => {
    render(["1"], undefined);
    expect(getLikeStatuses).not.toHaveBeenCalled();
  });

  it("seeds the hearts, then asks only about ids it has not seen", async () => {
    getLikeStatuses.mockImplementation(likedAll);
    const { result, rerender } = render(["1", "2"], "viewer");

    await waitFor(() => expect(result.current.liked).toEqual({ "1": true, "2": true }));
    expect(result.current.counts["1"]).toBe(10);

    rerender({ videoIds: ["1", "2", "3"], viewerId: "viewer" });
    await waitFor(() => expect(result.current.liked["3"]).toBe(true));

    expect(getLikeStatuses.mock.calls).toEqual([[["1", "2"]], [["3"]]]);
  });

  it("asks again for ids whose batch failed", async () => {
    getLikeStatuses.mockRejectedValueOnce(new Error("503"));
    const { result, rerender } = render(["1"], "viewer");
    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    getLikeStatuses.mockImplementation(likedAll);
    // The next page re-runs the effect with a fresh list.
    rerender({ videoIds: ["1", "2"], viewerId: "viewer" });

    await waitFor(() => expect(result.current.liked).toEqual({ "1": true, "2": true }));
    expect(getLikeStatuses).toHaveBeenLastCalledWith(["1", "2"]);
  });

  it("drops the hearts, not the counts, when the viewer changes", async () => {
    getLikeStatuses.mockImplementation(likedAll);
    const { result, rerender } = render(["1"], "first");
    await waitFor(() => expect(result.current.liked["1"]).toBe(true));

    getLikeStatuses.mockImplementation(() => new Promise(() => {}));
    rerender({ videoIds: ["1"], viewerId: "second" });

    expect(result.current.liked).toEqual({});
    expect(result.current.counts["1"]).toBe(10);
    expect(getLikeStatuses).toHaveBeenLastCalledWith(["1"]);
  });

  it("seeds again when the same viewer signs out and back in", async () => {
    getLikeStatuses.mockImplementation(likedAll);
    const { result, rerender } = render(["1"], "viewer");
    await waitFor(() => expect(result.current.liked["1"]).toBe(true));

    rerender({ videoIds: ["1"], viewerId: undefined });
    expect(result.current.liked).toEqual({});

    rerender({ videoIds: ["1"], viewerId: "viewer" });
    await waitFor(() => expect(result.current.liked["1"]).toBe(true));
    expect(getLikeStatuses).toHaveBeenCalledTimes(2);
  });

  it("ignores an answer meant for the previous viewer", async () => {
    let answerFirst: (statuses: LikeStatusResponse[]) => void = () => {};
    getLikeStatuses.mockImplementationOnce(
      () => new Promise((resolve) => (answerFirst = resolve)),
    );
    getLikeStatuses.mockImplementation(() => new Promise(() => {}));
    const { result, rerender } = render(["1"], "first");

    rerender({ videoIds: ["1"], viewerId: "second" });
    await act(async () => answerFirst([{ videoId: "1", liked: true, likeCount: 4 }]));

    expect(result.current.liked).toEqual({});
  });

  it("lets a like reply and a counts frame win over a late batch", async () => {
    let answer: (statuses: LikeStatusResponse[]) => void = () => {};
    getLikeStatuses.mockImplementation(() => new Promise((resolve) => (answer = resolve)));
    const { result } = render(["1", "2"], "viewer");

    act(() => {
      result.current.confirm({ videoId: "1", liked: false, likeCount: 3 });
      result.current.syncCount("2", 8);
    });
    await act(async () =>
      answer([
        { videoId: "1", liked: true, likeCount: 4 },
        { videoId: "2", liked: true, likeCount: 7 },
      ]),
    );

    expect(result.current.liked).toEqual({ "1": false, "2": true });
    expect(result.current.counts).toEqual({ "1": 3, "2": 8 });
  });
});
