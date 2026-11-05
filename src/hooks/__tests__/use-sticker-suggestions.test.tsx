import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StickerView, SuggestionTopic } from "@/lib/api/conversations";

const { fetchSuggestionTopics, fetchStickerSuggestions } = vi.hoisted(() => ({
  fetchSuggestionTopics: vi.fn<(signal?: AbortSignal) => Promise<SuggestionTopic[]>>(),
  fetchStickerSuggestions: vi.fn<(topicId: string, signal?: AbortSignal) => Promise<StickerView[]>>(),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  fetchSuggestionTopics: (signal?: AbortSignal) => fetchSuggestionTopics(signal),
  fetchStickerSuggestions: (topicId: string, signal?: AbortSignal) => fetchStickerSuggestions(topicId, signal),
}));

import {
  SUGGESTION_DEBOUNCE_MS,
  resetStickerSuggestionCaches,
  useStickerSuggestions,
} from "@/hooks/use-sticker-suggestions";

const sticker = (id: string): StickerView => ({
  stickerId: `giphy:${id}`,
  name: id,
  url: `https://media.giphy.com/media/${id}/giphy.webp`,
  width: 200,
  height: 200,
});

const TOPICS: SuggestionTopic[] = [
  { id: "happy", keywords: ["vui"], patterns: [] },
  { id: "sad", keywords: ["buồn"], patterns: [] },
  { id: "love", keywords: ["yêu"], patterns: [] },
];

/** React renders when an `act` ends, so each step of the chain (topics, then the pause, then the pool) gets its own. */
const settle = async (ms = 0) => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
  });
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
};

type Props = { text: string; enabled?: boolean; scope?: string };
const mount = (initial: Props) =>
  renderHook((props: Props) => useStickerSuggestions({ scope: "c1", enabled: true, ...props }), {
    initialProps: initial,
  });

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  resetStickerSuggestionCaches();
  fetchSuggestionTopics.mockReset().mockResolvedValue(TOPICS);
  fetchStickerSuggestions.mockReset().mockImplementation((topicId) => Promise.resolve([sticker(`${topicId}aaaaa`)]));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useStickerSuggestions", () => {
  it("asks the server for nothing until something is typed", async () => {
    mount({ text: "" });
    await settle(2000);

    expect(fetchSuggestionTopics).not.toHaveBeenCalled();
    expect(fetchStickerSuggestions).not.toHaveBeenCalled();
  });

  it("offers stickers for a feeling only after a pause in typing", async () => {
    const { result } = mount({ text: "vui" });
    await settle(SUGGESTION_DEBOUNCE_MS - 100);
    expect(result.current.stickers).toEqual([]);

    await settle(200);

    expect(fetchStickerSuggestions).toHaveBeenCalledWith("happy", expect.any(AbortSignal));
    expect(result.current.stickers).toEqual([sticker("happyaaaaa")]);
  });

  it("does not ask for stickers for a message that matches nothing", async () => {
    const { result } = mount({ text: "ok" });
    await settle(2000);

    expect(fetchSuggestionTopics).toHaveBeenCalledTimes(1);
    expect(fetchStickerSuggestions).not.toHaveBeenCalled();
    expect(result.current.stickers).toEqual([]);
  });

  it("sends the topic's name, never the text that was typed", async () => {
    mount({ text: "hôm nay vui" });
    await settle(1000);

    expect(fetchStickerSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchStickerSuggestions.mock.calls[0]?.[0]).toBe("happy");
  });

  it("takes the stickers away at once when the text stops matching", async () => {
    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);
    expect(result.current.stickers).toHaveLength(1);

    rerender({ text: "vui quá trời luôn" });

    expect(result.current.stickers).toEqual([]);
  });

  it("waits again when the text moves to another feeling", async () => {
    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);

    rerender({ text: "buồn" });
    expect(result.current.stickers).toEqual([]);
    await settle(SUGGESTION_DEBOUNCE_MS + 50);

    expect(result.current.stickers).toEqual([sticker("sadaaaaa")]);
  });

  it("offers nothing while disabled or without a conversation", async () => {
    const off = mount({ text: "vui", enabled: false });
    const orphan = mount({ text: "vui", scope: undefined });
    await settle(2000);

    expect(off.result.current.stickers).toEqual([]);
    expect(orphan.result.current.stickers).toEqual([]);
    expect(fetchStickerSuggestions).not.toHaveBeenCalled();
  });

  it("keeps a pool for a while instead of asking again for the same feeling", async () => {
    const first = mount({ text: "vui" });
    await settle(1000);
    first.unmount();

    const second = mount({ text: "vui" });
    await settle(1000);

    expect(second.result.current.stickers).toHaveLength(1);
    expect(fetchStickerSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchSuggestionTopics).toHaveBeenCalledTimes(1);
  });

  it("shows nothing, quietly, when the server cannot answer", async () => {
    fetchSuggestionTopics.mockRejectedValue(new Error("down"));
    const lost = mount({ text: "vui" });
    await settle(1000);
    expect(lost.result.current.stickers).toEqual([]);

    fetchSuggestionTopics.mockResolvedValue(TOPICS);
    fetchStickerSuggestions.mockRejectedValue(new Error("down"));
    const noPool = mount({ text: "vui" });
    await settle(1000);
    expect(noPool.result.current.stickers).toEqual([]);
  });

  it("stays away for that feeling once it is closed, but not for the next one", async () => {
    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);

    act(() => result.current.dismiss());
    expect(result.current.stickers).toEqual([]);
    rerender({ text: "vui " });
    await settle(1000);
    expect(result.current.stickers).toEqual([]);

    rerender({ text: "yêu" });
    await settle(1000);
    expect(result.current.stickers).toHaveLength(1);
  });

  it("goes quiet for the conversation after two closes in a row", async () => {
    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);
    act(() => result.current.dismiss());

    rerender({ text: "buồn" });
    await settle(1000);
    act(() => result.current.dismiss());

    rerender({ text: "yêu" });
    await settle(1000);
    expect(result.current.stickers).toEqual([]);

    const later = mount({ text: "vui" });
    await settle(1000);
    expect(later.result.current.stickers).toEqual([]);
    const other = mount({ text: "vui", scope: "c2" });
    await settle(1000);
    expect(other.result.current.stickers).toHaveLength(1);
  });

  it("counts a message sent past the suggestions as closing them, but only when they were showing", async () => {
    const quiet = mount({ text: "ok" });
    await settle(1000);
    act(() => quiet.result.current.ignore());
    act(() => quiet.result.current.ignore());
    expect(window.localStorage.getItem("tt.chat.sticker-suggest.v1")).toBeNull();

    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);
    act(() => result.current.ignore());
    rerender({ text: "buồn" });
    await settle(1000);
    act(() => result.current.ignore());

    rerender({ text: "yêu" });
    await settle(1000);
    expect(result.current.stickers).toEqual([]);
  });

  it("does not count a sticker that was sent as a close", async () => {
    const { result, rerender } = mount({ text: "vui" });
    await settle(1000);
    act(() => result.current.used());
    expect(result.current.stickers).toEqual([]);

    rerender({ text: "buồn" });
    await settle(1000);
    act(() => result.current.dismiss());

    rerender({ text: "yêu" });
    await settle(1000);
    expect(result.current.stickers).toHaveLength(1);
  });
});
