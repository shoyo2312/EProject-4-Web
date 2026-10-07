import { describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useEscapeKey } from "@/hooks/use-escape-key";

const pressEscape = () =>
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));

describe("useEscapeKey", () => {
  it("only the layer enabled last answers", () => {
    const below = vi.fn();
    const above = vi.fn();
    const first = renderHook(() => useEscapeKey(below));
    const second = renderHook(() => useEscapeKey(above));

    pressEscape();
    expect(above).toHaveBeenCalledTimes(1);
    expect(below).not.toHaveBeenCalled();

    second.unmount();
    pressEscape();
    expect(below).toHaveBeenCalledTimes(1);

    first.unmount();
  });

  it("a disabled layer is skipped, and re-enabling puts it on top", () => {
    const modal = vi.fn();
    const drawer = vi.fn();
    const first = renderHook(() => useEscapeKey(modal));
    const second = renderHook(({ open }) => useEscapeKey(drawer, open), {
      initialProps: { open: false },
    });

    pressEscape();
    expect(modal).toHaveBeenCalledTimes(1);

    second.rerender({ open: true });
    pressEscape();
    expect(drawer).toHaveBeenCalledTimes(1);
    expect(modal).toHaveBeenCalledTimes(1);

    first.unmount();
    second.unmount();
  });

  it("calls the latest callback without moving the layer", () => {
    const below = vi.fn();
    const stale = vi.fn();
    const fresh = vi.fn();
    const first = renderHook(({ onEscape }) => useEscapeKey(onEscape), {
      initialProps: { onEscape: stale },
    });
    const second = renderHook(() => useEscapeKey(below));

    // A new callback on the lower layer must not lift it above the upper one.
    first.rerender({ onEscape: fresh });
    pressEscape();
    expect(below).toHaveBeenCalledTimes(1);
    expect(fresh).not.toHaveBeenCalled();

    second.unmount();
    pressEscape();
    expect(fresh).toHaveBeenCalledTimes(1);
    expect(stale).not.toHaveBeenCalled();

    first.unmount();
  });
});
