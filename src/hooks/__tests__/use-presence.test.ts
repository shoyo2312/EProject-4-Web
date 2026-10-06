import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { usePresence } from "@/hooks/use-presence";

const renderPresence = (open: boolean) =>
  renderHook(({ open }) => usePresence(open, 300), { initialProps: { open } });

describe("usePresence", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("mounts the moment it opens", () => {
    const { result, rerender } = renderPresence(false);
    expect(result.current).toEqual({ mounted: false, closing: false });

    rerender({ open: true });

    expect(result.current).toEqual({ mounted: true, closing: false });
  });

  it("stays mounted, closing, for the whole exit and then unmounts", () => {
    const { result, rerender } = renderPresence(true);

    rerender({ open: false });
    expect(result.current).toEqual({ mounted: true, closing: true });

    act(() => {
      vi.advanceTimersByTime(299);
    });
    expect(result.current).toEqual({ mounted: true, closing: true });

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current).toEqual({ mounted: false, closing: false });
  });

  it("cancels the exit when reopened before it ends", () => {
    const { result, rerender } = renderPresence(true);

    rerender({ open: false });
    act(() => {
      vi.advanceTimersByTime(150);
    });
    rerender({ open: true });
    expect(result.current).toEqual({ mounted: true, closing: false });

    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(result.current).toEqual({ mounted: true, closing: false });
  });
});
