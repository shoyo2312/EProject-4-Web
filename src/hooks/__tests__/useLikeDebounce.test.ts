import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLikeDebounce } from "../useLikeDebounce";

describe("useLikeDebounce", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("sends nothing when the taps cancel out", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLikeDebounce(false, send));

    act(() => {
      result.current.toggle();
      result.current.toggle();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(send).not.toHaveBeenCalled();
  });

  it("sends one request for a burst that ends on the opposite state", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLikeDebounce(false, send));

    act(() => {
      result.current.toggle();
      result.current.toggle();
      result.current.toggle();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(true);
  });

  it("shows the new state immediately, before anything is sent", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useLikeDebounce(false, send));

    act(() => {
      result.current.toggle();
    });

    expect(result.current.liked).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });

  it("rolls back to the server's value when send rejects (e.g. a 429 LIKE_RATE_LIMITED)", async () => {
    const send = vi.fn().mockRejectedValue(new Error("429 LIKE_RATE_LIMITED"));
    const { result } = renderHook(() => useLikeDebounce(false, send));

    act(() => {
      result.current.toggle();
    });
    expect(result.current.liked).toBe(true);

    // `advanceTimersByTimeAsync` both fires the flush timer and drains the
    // microtask queue, so the rejected `send` promise's `.catch` runs before
    // this resolves — a plain `advanceTimersByTime` would fire the timer but
    // leave the rejection handler still pending on the microtask queue.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(600);
    });

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(true);
    // The server never accepted the like — the UI must not keep showing it as
    // liked. This is the one branch of `flush`'s `.catch` no other test hits.
    expect(result.current.liked).toBe(false);
  });

  it("keeps the pending tap — and still sends it — when serverLiked moves mid-window", () => {
    const send = vi.fn().mockResolvedValue(undefined);
    const { result, rerender } = renderHook(
      ({ serverLiked }) => useLikeDebounce(serverLiked, send),
      { initialProps: { serverLiked: false } },
    );

    act(() => {
      result.current.toggle(); // desired -> true, flush scheduled 500ms out
    });
    expect(result.current.liked).toBe(true);

    // A realtime frame (or anything else driving the parent) reports the
    // server has independently caught up to `true` — arriving mid-window,
    // before this tap's own request has gone out. It must not be read as
    // "this tap is already confirmed, there's nothing left to send": the
    // hook has no way to know the frame is about *this* tap rather than some
    // other event, and the whole point of the burst window is that only the
    // request this tap actually schedules counts as confirming it.
    rerender({ serverLiked: true });
    expect(result.current.liked).toBe(true);
    expect(send).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(600);
    });

    // Without the `timer.current === null` guard on the resync effect, the
    // rerender above would have quietly set `confirmed.current` to `true` —
    // equal to this tap's own pending target — and `flush` would then see
    // `target === confirmed` and skip `send` entirely, silently dropping a
    // tap the user actually made.
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(true);
  });
});
