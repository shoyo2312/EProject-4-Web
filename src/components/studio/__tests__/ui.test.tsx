import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { Popover } from "@/components/studio/ui";

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const popover = () =>
  render(
    <Popover
      trigger={({ toggle }) => (
        <button type="button" onClick={toggle}>
          Open
        </button>
      )}
    >
      {(close) => (
        <button type="button" onClick={close}>
          Inside
        </button>
      )}
    </Popover>,
  );

describe("Popover", () => {
  it("does not build its menu while closed", () => {
    popover();
    expect(screen.queryByRole("button", { name: "Inside" })).toBeNull();
  });

  it("builds the menu once opened and tears it down after the close animation", () => {
    popover();
    fireEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Inside" }));
    expect(screen.getByRole("button", { name: "Inside" })).toBeTruthy();

    act(() => vi.advanceTimersByTime(250));
    expect(screen.queryByRole("button", { name: "Inside" })).toBeNull();
  });
});
