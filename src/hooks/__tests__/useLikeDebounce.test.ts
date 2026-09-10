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
});
