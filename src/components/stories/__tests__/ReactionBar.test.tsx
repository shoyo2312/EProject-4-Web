import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ReactionBar } from "@/components/stories/ReactionBar";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("ReactionBar", () => {
  it("renders five reactions in order and marks the chosen one pressed", () => {
    render(<ReactionBar value="WOW" onChange={() => {}} signedIn onRequireLogin={() => {}} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map((button) => button.getAttribute("aria-label"))).toEqual(["Like", "Love", "Wow", "Angry", "Sad"]);
    expect(buttons.map((button) => button.getAttribute("aria-pressed"))).toEqual(["false", "false", "true", "false", "false"]);
  });

  it("clears when the chosen one is tapped again and replaces when another is", () => {
    const onChange = vi.fn();
    render(<ReactionBar value="WOW" onChange={onChange} signedIn onRequireLogin={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Wow" }));
    expect(onChange).toHaveBeenLastCalledWith(null);

    fireEvent.click(screen.getByRole("button", { name: "Sad" }));
    expect(onChange).toHaveBeenLastCalledWith("SAD");
  });

  it("asks to sign in instead of reacting when signed out", () => {
    const onChange = vi.fn();
    const onRequireLogin = vi.fn();
    render(<ReactionBar value={null} onChange={onChange} signedIn={false} onRequireLogin={onRequireLogin} />);

    fireEvent.click(screen.getByRole("button", { name: "Love" }));

    expect(onRequireLogin).toHaveBeenCalledOnce();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does not let a tap reach the story's step buttons", () => {
    const outer = vi.fn();
    render(
      <div onClick={outer} onPointerDown={outer}>
        <ReactionBar value={null} onChange={() => {}} signedIn onRequireLogin={() => {}} />
      </div>,
    );

    fireEvent.pointerDown(screen.getByRole("button", { name: "Like" }));
    fireEvent.click(screen.getByRole("button", { name: "Like" }));

    expect(outer).not.toHaveBeenCalled();
  });

  it("floats copies of the emoji that disappear after 900ms", () => {
    vi.useFakeTimers();
    render(<ReactionBar value={null} onChange={() => {}} signedIn onRequireLogin={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: "Love" }));
    const floating = document.querySelectorAll("[data-float]").length;
    expect(floating).toBeGreaterThanOrEqual(4);
    expect(floating).toBeLessThanOrEqual(6);

    act(() => vi.advanceTimersByTime(900));
    expect(document.querySelectorAll("[data-float]")).toHaveLength(0);
  });
});
