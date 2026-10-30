import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { MessagesLink } from "@/components/messages/MessagesLink";
import { PanelNavContext } from "@/components/messages/panel/MessagesPanelProvider";

vi.mock("next/link", () => ({
  default: ({ href, ...rest }: React.ComponentProps<"a"> & { href: string }) => <a href={href} {...rest} />,
}));

afterEach(cleanup);

describe("MessagesLink", () => {
  it("navigates the panel, not the page, when rendered inside it", () => {
    const go = vi.fn();
    render(
      <PanelNavContext.Provider value={go}>
        <MessagesLink href="/messages/c1">row</MessagesLink>
      </PanelNavContext.Provider>,
    );
    const notPrevented = fireEvent.click(screen.getByText("row"));
    expect(go).toHaveBeenCalledWith({ kind: "conversation", id: "c1" });
    expect(notPrevented).toBe(false);
  });

  it("leaves modified clicks to the browser (new tab)", () => {
    const go = vi.fn();
    render(
      <PanelNavContext.Provider value={go}>
        <MessagesLink href="/messages/c1">row</MessagesLink>
      </PanelNavContext.Provider>,
    );
    fireEvent.click(screen.getByText("row"), { ctrlKey: true });
    expect(go).not.toHaveBeenCalled();
  });

  it("is a plain link outside the panel", () => {
    render(<MessagesLink href="/messages/c1">row</MessagesLink>);
    expect(fireEvent.click(screen.getByText("row"))).toBe(true);
  });
});
