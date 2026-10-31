import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ImageView } from "@/lib/api/conversations";

const { fetchChatImage } = vi.hoisted(() => ({ fetchChatImage: vi.fn<(url: string, signal?: AbortSignal) => Promise<Blob>>() }));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  fetchChatImage: (url: string, signal?: AbortSignal) => fetchChatImage(url, signal),
}));

import { ImageMessage } from "@/components/messages/thread/ImageMessage";

let counter = 0;
const image = (over: Partial<ImageView> = {}): ImageView => {
  counter += 1;
  return { imageId: `i${counter}`, url: `/api/v1/conversations/c1/images/i${counter}`, mime: "image/png", width: 1000, height: 500, size: 10, ...over };
};
const flush = () => act(async () => {});

beforeEach(() => {
  fetchChatImage.mockReset().mockResolvedValue(new Blob(["x"], { type: "image/png" }));
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:img"), revokeObjectURL: vi.fn() }));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("ImageMessage", () => {
  it("reserves the box from the server's size before the bytes arrive, keeping the proportions", async () => {
    fetchChatImage.mockReturnValue(new Promise(() => {}));
    const { container } = render(<ImageMessage image={image({ width: 1000, height: 500 })} />);
    const box = container.querySelector<HTMLElement>("[data-image-box]")!;
    expect(box.style.width).toBe("280px");
    expect(box.style.aspectRatio).toBe("280 / 140");
    expect(screen.getByRole("status", { name: "Loading photo" })).toBeTruthy();
  });

  it("keeps the same box when the picture has loaded", async () => {
    const { container } = render(<ImageMessage image={image()} />);
    const before = container.querySelector<HTMLElement>("[data-image-box]")!.style.aspectRatio;
    await flush();
    expect(screen.getByAltText("Photo")).toBeTruthy();
    expect(container.querySelector<HTMLElement>("[data-image-box]")!.style.aspectRatio).toBe(before);
  });

  it("fetches with the viewer's token through the API client, never an unauthenticated src", async () => {
    const view = image();
    render(<ImageMessage image={view} />);
    await flush();
    expect(fetchChatImage).toHaveBeenCalledWith(view.url, expect.any(AbortSignal));
    expect(screen.getByAltText("Photo").getAttribute("src")).toBe("blob:img");
  });

  it("says it could not load and retries on request", async () => {
    fetchChatImage.mockRejectedValueOnce(new Error("down"));
    render(<ImageMessage image={image()} />);
    await flush();
    expect(screen.getByText("Couldn't load photo")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await flush();
    expect(screen.getByAltText("Photo")).toBeTruthy();
  });

  it("opens the viewer on press and closes it with Escape, the cross and the backdrop", async () => {
    render(<ImageMessage image={image()} />);
    await flush();
    fireEvent.click(screen.getByRole("button", { name: "Open photo" }));
    expect(screen.getByRole("dialog", { name: "Photo" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Close photo" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Open photo" }));
    fireEvent.click(screen.getByRole("dialog"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("says so when the server sent no picture", () => {
    render(<ImageMessage image={null} />);
    expect(screen.getByText("Photo unavailable")).toBeTruthy();
  });
});
