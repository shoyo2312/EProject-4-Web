import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { PickerField } from "@/components/settings/rows/screen-time/PickerField";

const HOURS = Array.from({ length: 12 }, (_, i) => String(i + 1).padStart(2, "0"));

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("picks the option a scrolled column comes to rest on, and only once it has", () => {
  const onSelect = vi.fn();
  render(
    <PickerField
      label="Start time"
      value="10:00"
      columns={[{ label: "Hour", options: HOURS, selected: 9, onSelect }]}
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "Start time" }));
  const column = screen.getByRole("listbox", { name: "Hour" });
  expect(column.scrollTop).toBe(9 * 32);

  column.scrollTop = 3 * 32;
  fireEvent.scroll(column);
  act(() => vi.advanceTimersByTime(100));
  expect(onSelect).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(100));
  expect(onSelect).toHaveBeenCalledWith(3);
  expect(onSelect).toHaveBeenCalledTimes(1);

  // Back where it already is: nothing to pick again.
  column.scrollTop = 9 * 32;
  fireEvent.scroll(column);
  act(() => vi.advanceTimersByTime(200));
  expect(onSelect).toHaveBeenCalledTimes(1);
});
