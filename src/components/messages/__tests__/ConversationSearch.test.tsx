import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";

import { ConversationSearch } from "@/components/messages/ConversationSearch";

function Harness() {
  const [value, setValue] = useState("");
  return <ConversationSearch value={value} onChange={setValue} />;
}

describe("ConversationSearch", () => {
  afterEach(cleanup);

  it("clears through the app's own button and returns focus to the input", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Search conversations") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "vinh" } });
    fireEvent.click(screen.getByRole("button", { name: "Clear search" }));
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
  });

  it("is a text input so the browser draws no second clear control", () => {
    render(<Harness />);
    expect(screen.getByLabelText("Search conversations").getAttribute("type")).toBe("text");
  });

  it("hides the clear button from assistive tech while empty", () => {
    render(<Harness />);
    expect(screen.queryByRole("button", { name: "Clear search" })).toBeNull();
  });

  it("Escape clears a query without bubbling", () => {
    render(<Harness />);
    const input = screen.getByLabelText("Search conversations") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "a" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input.value).toBe("");
  });
});
