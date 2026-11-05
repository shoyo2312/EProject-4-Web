import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StickerView } from "@/lib/api/conversations";

const { searchGiphyStickers } = vi.hoisted(() => ({
  searchGiphyStickers: vi.fn<(query: string, signal?: AbortSignal) => Promise<StickerView[]>>(),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  searchGiphyStickers: (query: string, signal?: AbortSignal) => searchGiphyStickers(query, signal),
}));

import { useGiphyStickers } from "@/hooks/use-giphy-stickers";

const sticker = (id: string): StickerView => ({
  stickerId: `giphy:${id}`,
  name: id,
  url: `https://media.giphy.com/media/${id}/giphy.webp`,
  width: 200,
  height: 200,
});

beforeEach(() => {
  vi.useFakeTimers();
  searchGiphyStickers.mockReset();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useGiphyStickers", () => {
  it("loads the trending stickers at once for a blank query", async () => {
    searchGiphyStickers.mockResolvedValue([sticker("aaaaa")]);
    const { result } = renderHook(() => useGiphyStickers("", true));
    expect(result.current.status).toBe("loading");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(searchGiphyStickers).toHaveBeenCalledWith("", expect.any(AbortSignal));
    expect(result.current).toMatchObject({ status: "ready", stickers: [sticker("aaaaa")] });
  });

  it("does nothing until the picker asks", async () => {
    renderHook(() => useGiphyStickers("", false));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(1000);
    });
    expect(searchGiphyStickers).not.toHaveBeenCalled();
  });

  it("waits for a pause in typing and searches once, with the trimmed text", async () => {
    searchGiphyStickers.mockResolvedValue([sticker("bbbbb")]);
    const { result, rerender } = renderHook(({ q }) => useGiphyStickers(q, true), { initialProps: { q: "b" } });
    rerender({ q: "bu" });
    rerender({ q: " bunny " });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(searchGiphyStickers).not.toHaveBeenCalled();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(searchGiphyStickers).toHaveBeenCalledTimes(1);
    expect(searchGiphyStickers).toHaveBeenCalledWith("bunny", expect.any(AbortSignal));
    expect(result.current.status).toBe("ready");
  });

  it("never shows an old answer for a newer query", async () => {
    searchGiphyStickers.mockResolvedValue([sticker("ccccc")]);
    const { result, rerender } = renderHook(({ q }) => useGiphyStickers(q, true), { initialProps: { q: "" } });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("ready");
    rerender({ q: "cat" });
    expect(result.current.status).toBe("loading");
  });

  it("reports a failure and tries again on reload", async () => {
    searchGiphyStickers.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([sticker("ddddd")]);
    const { result } = renderHook(() => useGiphyStickers("", true));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("error");
    act(() => result.current.reload());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(result.current.status).toBe("ready");
    expect(searchGiphyStickers).toHaveBeenCalledTimes(2);
  });
});
