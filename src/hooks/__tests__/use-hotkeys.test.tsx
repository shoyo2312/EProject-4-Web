import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { useHotkeys } from "@/hooks/use-hotkeys";

const like = vi.fn();
const play = vi.fn();

function Page({ modal = false }: { modal?: boolean }) {
  useHotkeys({ l: like, " ": play });
  return (
    <>
      <input aria-label="comment" />
      <button type="button">rail</button>
      {modal && <div role="dialog" aria-modal="true" />}
    </>
  );
}

afterEach(() => {
  cleanup();
  like.mockReset();
  play.mockReset();
});

describe("useHotkeys", () => {
  it("runs a binding from anywhere on the page, case-insensitively", () => {
    render(<Page />);
    fireEvent.keyDown(document.body, { key: "L" });
    expect(like).toHaveBeenCalledOnce();
  });

  it("stays out of the way of typing, modifiers, open modals, and Space on a button", () => {
    const { rerender } = render(<Page />);
    fireEvent.keyDown(screen.getByLabelText("comment"), { key: "l" });
    fireEvent.keyDown(document.body, { key: "l", metaKey: true });
    fireEvent.keyDown(screen.getByText("rail"), { key: " " });
    rerender(<Page modal />);
    fireEvent.keyDown(document.body, { key: "l" });

    expect(like).not.toHaveBeenCalled();
    expect(play).not.toHaveBeenCalled();
  });
});
