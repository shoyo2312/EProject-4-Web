import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StickerPack, StickerView } from "@/lib/api/conversations";

const { listStickerPacks } = vi.hoisted(() => ({ listStickerPacks: vi.fn<() => Promise<StickerPack[]>>() }));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listStickerPacks: () => listStickerPacks(),
}));

import { Composer } from "@/components/messages/thread/Composer";
import { resetStickerPacksCache } from "@/hooks/use-sticker-packs";

const FIRE: StickerView = { stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 };
const SPARKLES: StickerView = { stickerId: "sparkles", name: "Sparkles", url: "http://x/sparkles.png", width: 256, height: 256 };
const flush = () => act(async () => {});

beforeEach(() => {
  listStickerPacks.mockReset().mockResolvedValue([{ packId: "fluent-3d", name: "Fluent 3D", stickers: [FIRE, SPARKLES] }]);
  resetStickerPacksCache();
  // In a browser the frame runs after React has committed the new value; a microtask is the closest jsdom gets.
  vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
    queueMicrotask(() => callback(0));
    return 0;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function mount(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = vi.fn().mockResolvedValue(true);
  const onSendSticker = vi.fn().mockResolvedValue(true);
  const view = render(<Composer disabled={false} onSend={onSend} onSendSticker={onSendSticker} {...over} />);
  const box = () => screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
  const openPicker = () => fireEvent.click(screen.getByRole("button", { name: "Emoji and stickers" }));
  return { ...view, onSend, onSendSticker, box, openPicker };
}

const type = (box: HTMLTextAreaElement, value: string, selection?: [number, number]) => {
  fireEvent.change(box, { target: { value } });
  if (selection) box.setSelectionRange(selection[0], selection[1]);
};

describe("Composer emoji", () => {
  it("inserts at the caret and sends nothing", () => {
    const { box, openPicker, onSend } = mount();
    type(box(), "helloworld", [5, 5]);
    openPicker();

    fireEvent.click(screen.getByRole("button", { name: "😀" }));

    expect(box().value).toBe("hello😀world");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("replaces the selected text", () => {
    const { box, openPicker } = mount();
    type(box(), "say HELLO now", [4, 9]);
    openPicker();

    fireEvent.click(screen.getByRole("button", { name: "🎉" }));

    expect(box().value).toBe("say 🎉 now");
  });

  it("puts the caret after the emoji and focus back in the box", async () => {
    const { box, openPicker } = mount();
    type(box(), "ab", [1, 1]);
    openPicker();

    fireEvent.click(screen.getByRole("button", { name: "❤️" }));
    await flush();

    expect(document.activeElement).toBe(box());
    expect(box().selectionStart).toBe(1 + "❤️".length);
    expect(box().selectionEnd).toBe(1 + "❤️".length);
  });

  it("appends at the end when there is no selection yet", () => {
    const { box, openPicker } = mount();
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "😀" }));
    expect(box().value).toBe("😀");
  });

  it("sends the draft, emoji included, with Enter", () => {
    const { box, openPicker, onSend } = mount();
    type(box(), "hi", [2, 2]);
    openPicker();
    fireEvent.click(screen.getByRole("button", { name: "😀" }));

    fireEvent.keyDown(box(), { key: "Enter" });

    expect(onSend).toHaveBeenCalledWith("hi😀");
  });

  it("does not send on Shift+Enter, or on the Enter that commits an IME composition", () => {
    const { box, onSend } = mount();
    type(box(), "xin chào");

    fireEvent.keyDown(box(), { key: "Enter", shiftKey: true });
    fireEvent.keyDown(box(), { key: "Enter", isComposing: true });
    fireEvent.keyDown(box(), { key: "Enter", keyCode: 229 });

    expect(onSend).not.toHaveBeenCalled();
  });
});

describe("Composer picker", () => {
  it("has an Emoji tab and a Sticker tab", async () => {
    const { openPicker } = mount();
    openPicker();

    expect(screen.getByRole("tab", { name: "Emoji" }).getAttribute("aria-selected")).toBe("true");
    fireEvent.click(screen.getByRole("tab", { name: "Sticker" }));
    await flush();

    expect(screen.getByRole("tab", { name: "Sticker" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("button", { name: "Send sticker: Fire" })).toBeTruthy();
  });

  it("closes on Escape and on a press outside, and not on a press inside", () => {
    const { openPicker, baseElement } = mount();
    openPicker();
    expect(screen.queryByRole("tablist")).not.toBeNull();

    fireEvent.pointerDown(screen.getByRole("tablist"));
    expect(screen.queryByRole("tablist")).not.toBeNull();

    fireEvent.pointerDown(baseElement);
    expect(screen.queryByRole("tablist")).toBeNull();

    openPicker();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("cannot be opened while sending is not allowed", () => {
    mount({ disabled: true });
    expect((screen.getByRole("button", { name: "Emoji and stickers" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("closes itself if sending becomes disallowed while open", () => {
    const { openPicker, rerender, onSend, onSendSticker } = mount();
    openPicker();
    rerender(<Composer disabled onSend={onSend} onSendSticker={onSendSticker} />);
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("says so and offers a retry when the stickers cannot be loaded", async () => {
    listStickerPacks.mockReset().mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([
      { packId: "fluent-3d", name: "Fluent 3D", stickers: [FIRE] },
    ]);
    const { openPicker } = mount();
    openPicker();
    fireEvent.click(screen.getByRole("tab", { name: "Sticker" }));
    await flush();

    expect(screen.getByText("Couldn't load stickers")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await flush();

    expect(screen.getByRole("button", { name: "Send sticker: Fire" })).toBeTruthy();
  });
});

describe("Composer stickers", () => {
  async function openStickers(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
    const mounted = mount(over);
    mounted.openPicker();
    fireEvent.click(screen.getByRole("tab", { name: "Sticker" }));
    await flush();
    return mounted;
  }

  it("sends a sticker as its own message and leaves the draft alone", async () => {
    const { box, onSend, onSendSticker } = await openStickers();
    type(box(), "half-written thought");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Fire" }));
    });

    expect(onSendSticker).toHaveBeenCalledWith(FIRE);
    expect(onSend).not.toHaveBeenCalled();
    expect(box().value).toBe("half-written thought");
  });

  it("closes the picker once the sticker is sent", async () => {
    await openStickers();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Fire" }));
    });
    expect(screen.queryByRole("tablist")).toBeNull();
  });

  it("keeps the picker and the draft when the sticker fails, so it can be tried again", async () => {
    const onSendSticker = vi.fn().mockResolvedValue(false);
    const { box } = await openStickers({ onSendSticker });
    type(box(), "keep me");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Fire" }));
    });

    expect(screen.queryByRole("tablist")).not.toBeNull();
    expect(box().value).toBe("keep me");
  });

  it("keeps the draft when the sticker is cancelled at the confirmation step (it resolves false)", async () => {
    const onSendSticker = vi.fn().mockResolvedValue(false);
    const { box, onSend } = await openStickers({ onSendSticker });
    type(box(), "draft stays");

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Sparkles" }));
    });

    expect(box().value).toBe("draft stays");
    expect(onSend).not.toHaveBeenCalled();
  });

  it("sends once however many times it is pressed while the first is in flight", async () => {
    let finish: (sent: boolean) => void = () => {};
    const onSendSticker = vi.fn().mockReturnValue(new Promise<boolean>((resolve) => (finish = resolve)));
    await openStickers({ onSendSticker });
    const fire = screen.getByRole("button", { name: "Send sticker: Fire" });

    fireEvent.click(fire);
    fireEvent.click(fire);
    fireEvent.click(screen.getByRole("button", { name: "Send sticker: Sparkles" }));

    expect(onSendSticker).toHaveBeenCalledTimes(1);
    expect((fire as HTMLButtonElement).disabled).toBe(true);

    await act(async () => finish(true));
  });

  it("can send another sticker after the first has failed", async () => {
    const onSendSticker = vi.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    await openStickers({ onSendSticker });

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Fire" }));
    });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Fire" }));
    });

    expect(onSendSticker).toHaveBeenCalledTimes(2);
  });
});
