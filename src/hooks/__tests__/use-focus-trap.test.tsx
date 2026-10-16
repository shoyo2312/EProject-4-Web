import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";

import { useFocusTrap } from "@/hooks/use-focus-trap";

function Dialog() {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  return (
    <div ref={ref} role="dialog">
      <button type="button">first</button>
      <button type="button">last</button>
    </div>
  );
}

function Page({ open }: { open: boolean }) {
  return (
    <>
      <button type="button">opener</button>
      {open && <Dialog />}
    </>
  );
}

const tab = (shiftKey = false) => fireEvent.keyDown(document, { key: "Tab", shiftKey });

afterEach(cleanup);

describe("useFocusTrap", () => {
  it("moves focus in, wraps Tab at both ends, and hands focus back on close", () => {
    const { rerender } = render(<Page open={false} />);
    screen.getByText("opener").focus();

    rerender(<Page open />);
    expect(document.activeElement).toBe(screen.getByRole("dialog"));

    screen.getByText("last").focus();
    tab();
    expect(document.activeElement).toBe(screen.getByText("first"));
    tab(true);
    expect(document.activeElement).toBe(screen.getByText("last"));

    rerender(<Page open={false} />);
    expect(document.activeElement).toBe(screen.getByText("opener"));
  });
});
