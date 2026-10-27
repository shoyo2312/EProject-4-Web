import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { StickerMessage } from "@/components/messages/thread/StickerMessage";

afterEach(cleanup);

const FIRE = { stickerId: "fire", name: "Fire", url: "http://localhost:9000/video-media/stickers/fluent-3d/v1/fire.png", width: 256, height: 256 };

describe("StickerMessage", () => {
  it("draws the picture with its name as alt text and its size declared up front", () => {
    render(<StickerMessage sticker={FIRE} />);

    const img = screen.getByRole("img", { name: "Fire" });
    expect(img.getAttribute("src")).toBe(FIRE.url);
    expect(img.getAttribute("width")).toBe("256");
    expect(img.getAttribute("height")).toBe("256");
  });

  it("reserves a fixed box, so the picture arriving cannot move the history", () => {
    const { container } = render(<StickerMessage sticker={FIRE} />);
    expect((container.firstElementChild as HTMLElement).className).toMatch(/h-32 w-32/);
  });

  it("says so, in the same box, when the picture fails to load", () => {
    const { container } = render(<StickerMessage sticker={FIRE} />);
    fireEvent.error(screen.getByRole("img", { name: "Fire" }));

    expect(screen.getByRole("img", { name: "Sticker unavailable" })).toBeTruthy();
    expect(container.querySelector("img")).toBeNull();
    expect((container.firstElementChild as HTMLElement).className).toMatch(/h-32 w-32/);
  });

  it("says so when the catalog no longer knows the sticker", () => {
    render(<StickerMessage sticker={null} />);
    expect(screen.getByRole("img", { name: "Sticker unavailable" })).toBeTruthy();
  });
});
