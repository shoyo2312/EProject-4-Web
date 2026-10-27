import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { ChatAvatar } from "@/components/messages/ChatAvatar";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";

afterEach(cleanup);

describe("ChatAvatar", () => {
  it("draws the account's picture", () => {
    const { container } = render(<ChatAvatar src="https://cdn.example/a.png" />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/a.png");
  });

  it("falls back to the default picture when there is none", () => {
    const { container } = render(<ChatAvatar src={undefined} />);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(DEFAULT_AVATAR);
  });

  it("falls back to the default picture, then to a plain circle, when images fail to load", () => {
    const { container } = render(<ChatAvatar src="https://cdn.example/broken.png" />);

    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")?.getAttribute("src")).toBe(DEFAULT_AVATAR);

    fireEvent.error(container.querySelector("img")!);
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector("span")).not.toBeNull();
  });
});
