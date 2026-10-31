import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Composer, type ImageSend, type ImageSendResult } from "@/components/messages/thread/Composer";
import type { ImageView } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";

const UPLOADED: ImageView = { imageId: "img1", url: "/api/v1/conversations/c1/images/img1", mime: "image/png", width: 400, height: 300, size: 10 };
const png = (name = "cat.png", size = 2000) => new File([new Uint8Array(size)], name, { type: "image/png" });

beforeEach(() => {
  vi.stubGlobal("URL", Object.assign(URL, { createObjectURL: vi.fn(() => "blob:preview"), revokeObjectURL: vi.fn() }));
  vi.stubGlobal("requestAnimationFrame", (cb: FrameRequestCallback) => {
    queueMicrotask(() => cb(0));
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onUploadImage = vi.fn<(file: File, signal: AbortSignal) => Promise<ImageView>>().mockResolvedValue(UPLOADED);
  const onSendImage = vi.fn<(image: ImageSend) => Promise<ImageSendResult>>().mockResolvedValue({ ok: true });
  const onSend = vi.fn().mockResolvedValue(true);
  const props = { disabled: false, onSend, onSendSticker: vi.fn().mockResolvedValue(true), onUploadImage, onSendImage, ...over };
  const view = render(<Composer {...props} />);
  const box = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
  const choose = (file: File) => fireEvent.change(screen.getByTestId("photo-input"), { target: { files: [file] } });
  const send = () => fireEvent.click(screen.getByRole("button", { name: "Send message" }));
  return { ...view, props, onUploadImage, onSendImage, onSend, box, choose, send };
}

describe("Composer photos", () => {
  it("offers no photo button where photos are not wired", () => {
    render(<Composer disabled={false} onSend={vi.fn()} onSendSticker={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Add photo" })).toBeNull();
  });

  it("the photo button is a label for the file input, so the browser opens the chooser itself", () => {
    mount();
    const button = screen.getByRole("button", { name: "Add photo" }) as HTMLLabelElement;
    expect(button.tagName).toBe("LABEL");
    expect(button.control).toBe(screen.getByTestId("photo-input"));
    expect(screen.getByTestId("photo-input").className).not.toContain("hidden");
  });

  it("turns the photo button off while the composer is disabled", () => {
    mount({ disabled: true });
    expect(screen.getByTestId<HTMLInputElement>("photo-input").disabled).toBe(true);
    expect(screen.getByRole("button", { name: "Add photo" }).getAttribute("aria-disabled")).toBe("true");
  });

  it("choosing a photo makes a draft with a thumbnail and sends nothing", () => {
    const { choose, onUploadImage, onSendImage } = mount();
    choose(png());
    expect(screen.getByAltText("Photo to send")).toBeTruthy();
    expect(screen.getByText(/up to 5 MB/)).toBeTruthy();
    expect(onUploadImage).not.toHaveBeenCalled();
    expect(onSendImage).not.toHaveBeenCalled();
  });

  it("refuses a file of the wrong type or over the limit before any request", () => {
    const { choose, onUploadImage } = mount();
    choose(new File(["x"], "a.pdf", { type: "application/pdf" }));
    expect(screen.getByRole("alert").textContent).toMatch(/JPEG, PNG, GIF or WebP/);
    choose(png("big.png", 5 * 1024 * 1024 + 1));
    expect(screen.getByRole("alert").textContent).toMatch(/5 MB/);
    expect(screen.queryByAltText("Photo to send")).toBeNull();
    expect(onUploadImage).not.toHaveBeenCalled();
  });

  it("removing the photo drops the draft and keeps the typed text", () => {
    const { choose, box } = mount();
    fireEvent.change(box(), { target: { value: "caption" } });
    choose(png());
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(screen.queryByAltText("Photo to send")).toBeNull();
    expect(box().value).toBe("caption");
  });

  it("a paste of an image becomes a draft, while a paste of text is left alone", () => {
    const { box } = mount();
    const text = fireEvent.paste(box(), { clipboardData: { files: [], getData: () => "plain" } });
    expect(text).toBe(true);
    expect(screen.queryByAltText("Photo to send")).toBeNull();

    const notPrevented = fireEvent.paste(box(), { clipboardData: { files: [png("shot.png")] } });
    expect(notPrevented).toBe(false);
    expect(screen.getByAltText("Photo to send")).toBeTruthy();
  });

  it("a dropped file becomes a draft", () => {
    const file = png("drop.png");
    const { rerender, props } = mount();
    rerender(<Composer {...props} incomingFile={{ file }} />);
    expect(screen.getByAltText("Photo to send")).toBeTruthy();
  });

  it("uploads, then sends the id with the caption, and clears both on success", async () => {
    const { choose, box, send, onUploadImage, onSendImage } = mount();
    choose(png());
    fireEvent.change(box(), { target: { value: "  look at this  " } });
    send();
    await waitFor(() => expect(onSendImage).toHaveBeenCalledTimes(1));
    expect(onUploadImage).toHaveBeenCalledTimes(1);
    expect(onSendImage.mock.calls[0][0]).toMatchObject({ imageId: "img1", content: "look at this" });
    await waitFor(() => expect(screen.queryByAltText("Photo to send")).toBeNull());
    expect(box().value).toBe("");
  });

  it("sends a photo with no caption", async () => {
    const { choose, send, onSendImage } = mount();
    choose(png());
    send();
    await waitFor(() => expect(onSendImage).toHaveBeenCalled());
    expect(onSendImage.mock.calls[0][0].content).toBeUndefined();
  });

  it("does not send twice when pressed again while it is in flight", async () => {
    let finish: (value: ImageSendResult) => void = () => {};
    const { choose, send, onSendImage, onUploadImage } = mount();
    onSendImage.mockImplementation(() => new Promise((resolve) => (finish = resolve)));
    choose(png());
    send();
    await waitFor(() => expect(onSendImage).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onSendImage).toHaveBeenCalledTimes(1);
    expect(onUploadImage).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Sending…")).toBeTruthy();
    await act(async () => finish({ ok: true }));
  });

  it("shows the upload failing, keeps everything, and retries the upload with the same key", async () => {
    const { choose, box, send, onUploadImage, onSendImage } = mount();
    onUploadImage.mockRejectedValueOnce(new ApiError(0, "NETWORK_ERROR", "down"));
    choose(png());
    fireEvent.change(box(), { target: { value: "caption" } });
    send();
    await screen.findByRole("alert");
    expect(screen.getByAltText("Photo to send")).toBeTruthy();
    expect(box().value).toBe("caption");
    expect(onSendImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSendImage).toHaveBeenCalledTimes(1));
    expect(onUploadImage).toHaveBeenCalledTimes(2);
  });

  it("after a failed send, retry reuses the stored upload and the same clientRequestId", async () => {
    const { choose, send, onUploadImage, onSendImage } = mount();
    onSendImage.mockResolvedValueOnce({ ok: false, error: new ApiError(0, "NETWORK_ERROR", "down") });
    choose(png());
    send();
    await screen.findByRole("alert");
    expect(screen.getByAltText("Photo to send")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSendImage).toHaveBeenCalledTimes(2));
    expect(onUploadImage).toHaveBeenCalledTimes(1);
    expect(onSendImage.mock.calls[1][0].clientRequestId).toBe(onSendImage.mock.calls[0][0].clientRequestId);
    await waitFor(() => expect(screen.queryByAltText("Photo to send")).toBeNull());
  });

  it("uploads again when the server no longer has the stored picture", async () => {
    const { choose, send, onUploadImage, onSendImage } = mount();
    onSendImage.mockResolvedValueOnce({ ok: false, error: new ApiError(400, "INVALID_MESSAGE", "gone") });
    choose(png());
    send();
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(onSendImage).toHaveBeenCalledTimes(2));
    expect(onUploadImage).toHaveBeenCalledTimes(2);
  });

  it("a declined question (a null error) leaves the draft quietly, without an error", async () => {
    const { choose, send, onSendImage } = mount();
    onSendImage.mockResolvedValueOnce({ ok: false, error: null });
    choose(png());
    send();
    await waitFor(() => expect(onSendImage).toHaveBeenCalled());
    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send message" }).disabled).toBe(false));
    expect(screen.queryByRole("alert")).toBeNull();
    expect(screen.getByAltText("Photo to send")).toBeTruthy();
  });

  it("a draft belongs to its conversation: remounting for another one starts clean", () => {
    const { choose, rerender, props } = mount();
    choose(png());
    rerender(<Composer key="other" {...props} />);
    expect(screen.queryByAltText("Photo to send")).toBeNull();
  });

  it("cancels the upload when the draft is removed mid-flight, and sends nothing", async () => {
    const { choose, send, onUploadImage, onSendImage } = mount();
    let signal: AbortSignal | undefined;
    onUploadImage.mockImplementation((_file, s) => {
      signal = s;
      return new Promise(() => {});
    });
    choose(png());
    send();
    await waitFor(() => expect(onUploadImage).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "Remove photo" }));
    expect(signal?.aborted).toBe(true);
    expect(onSendImage).not.toHaveBeenCalled();
    expect(screen.queryByAltText("Photo to send")).toBeNull();
  });

  it("limits the caption of a photo", () => {
    const { choose, box } = mount();
    choose(png());
    fireEvent.change(box(), { target: { value: "x".repeat(1001) } });
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Send message" }).disabled).toBe(true);
  });
});
