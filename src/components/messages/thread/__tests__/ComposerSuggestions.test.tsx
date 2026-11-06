import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StickerView, SuggestionTopic } from "@/lib/api/conversations";

const { fetchSuggestionTopics, fetchStickerSuggestions, searchGiphyStickers } = vi.hoisted(() => ({
  fetchSuggestionTopics: vi.fn<() => Promise<SuggestionTopic[]>>(),
  fetchStickerSuggestions: vi.fn<(topicId: string) => Promise<StickerView[]>>(),
  searchGiphyStickers: vi.fn<() => Promise<StickerView[]>>(),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  fetchSuggestionTopics: () => fetchSuggestionTopics(),
  fetchStickerSuggestions: (topicId: string) => fetchStickerSuggestions(topicId),
  searchGiphyStickers: () => searchGiphyStickers(),
}));

import { Composer } from "@/components/messages/thread/Composer";
import { SUGGESTION_DEBOUNCE_MS, resetStickerSuggestionCaches } from "@/hooks/use-sticker-suggestions";

const HAPPY: StickerView = { stickerId: "giphy:happy12345", name: "Happy dance", url: "http://x/h.webp", width: 200, height: 200 };

const settle = async (ms = SUGGESTION_DEBOUNCE_MS + 50) => {
  for (const step of [0, ms, 0]) {
    await act(async () => {
      await vi.advanceTimersByTimeAsync(step);
    });
  }
};

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  resetStickerSuggestionCaches();
  fetchSuggestionTopics.mockReset().mockResolvedValue([
    { id: "happy", keywords: ["vui"], patterns: [] },
    { id: "sad", keywords: ["buồn"], patterns: [] },
  ]);
  fetchStickerSuggestions.mockReset().mockResolvedValue([HAPPY]);
  searchGiphyStickers.mockReset().mockResolvedValue([]);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(over: Partial<React.ComponentProps<typeof Composer>> = {}) {
  const onSend = vi.fn().mockResolvedValue(true);
  const onSendSticker = vi.fn().mockResolvedValue(true);
  render(<Composer disabled={false} suggestionScope="c1" onSend={onSend} onSendSticker={onSendSticker} {...over} />);
  const box = screen.getByRole<HTMLTextAreaElement>("textbox", { name: "Message" });
  const bar = () => screen.queryByRole("group", { name: "Suggested stickers" });
  return { onSend, onSendSticker, box, bar };
}

const type = (box: HTMLTextAreaElement, value: string) => fireEvent.change(box, { target: { value } });

describe("Composer sticker suggestions", () => {
  it("offers stickers over the box for a short message that names a feeling", async () => {
    const { box, bar } = mount();
    type(box, "vui");
    expect(bar()).toBeNull();

    await settle();

    expect(bar()).not.toBeNull();
    expect(screen.getByRole("button", { name: "Send sticker: Happy dance" })).toBeTruthy();
  });

  it("offers nothing for an everyday message", async () => {
    const { box, bar } = mount();
    type(box, "ok mai gặp nhé bạn");
    await settle();

    expect(bar()).toBeNull();
    expect(fetchStickerSuggestions).not.toHaveBeenCalled();
  });

  it("offers nothing without a conversation to remember a close for", async () => {
    const { box, bar } = mount({ suggestionScope: undefined });
    type(box, "vui");
    await settle();

    expect(bar()).toBeNull();
    expect(fetchSuggestionTopics).not.toHaveBeenCalled();
  });

  it("sends the chosen sticker and leaves what was typed where it was", async () => {
    const { box, bar, onSendSticker, onSend } = mount();
    type(box, "vui");
    await settle();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Happy dance" }));
    });

    expect(onSendSticker).toHaveBeenCalledWith(HAPPY);
    expect(onSend).not.toHaveBeenCalled();
    expect(box.value).toBe("vui");
    expect(bar()).toBeNull();
  });

  it("keeps the bar when the sticker could not be sent", async () => {
    const { box, bar, onSendSticker } = mount();
    onSendSticker.mockResolvedValue(false);
    type(box, "vui");
    await settle();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send sticker: Happy dance" }));
    });

    expect(bar()).not.toBeNull();
  });

  it("goes away when closed, and the message is still there", async () => {
    const { box, bar } = mount();
    type(box, "vui");
    await settle();

    fireEvent.click(screen.getByRole("button", { name: "Hide sticker suggestions" }));

    expect(bar()).toBeNull();
    expect(box.value).toBe("vui");
  });

  it("goes away when the message is sent, and counts as passed over", async () => {
    const { box, bar, onSend } = mount();
    type(box, "vui");
    await settle();

    fireEvent.keyDown(box, { key: "Enter" });
    await act(async () => {});

    expect(onSend).toHaveBeenCalledWith("vui");
    expect(bar()).toBeNull();
    expect(JSON.parse(window.localStorage.getItem("tt.chat.sticker-suggest.v1") ?? "{}")).toEqual({
      c1: { dismissed: 1, mutedUntil: 0 },
    });
  });

  it("stays out of the way of the emoji and sticker picker", async () => {
    const { box, bar } = mount();
    type(box, "vui");
    await settle();
    expect(bar()).not.toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Emoji and stickers" }));

    expect(bar()).toBeNull();
  });
});
