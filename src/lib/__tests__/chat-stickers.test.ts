import { beforeEach, describe, expect, it } from "vitest";

import type { StickerView } from "@/lib/api/conversations";
import {
  MAX_RECENT_STICKERS,
  RECENT_STICKERS_KEY,
  STICKER_CATEGORIES,
  readRecentStickers,
  rememberSticker,
} from "@/lib/chat-stickers";

const sticker = (id: string): StickerView => ({
  stickerId: `giphy:${id}`,
  name: id,
  url: `https://media.giphy.com/media/${id}/giphy.webp`,
  width: 200,
  height: 200,
});

beforeEach(() => window.localStorage.clear());

describe("recent stickers", () => {
  it("starts empty", () => {
    expect(readRecentStickers()).toEqual([]);
  });

  it("puts the newest first and lists a repeated sticker once, at the front", () => {
    rememberSticker(sticker("aaaaa"));
    rememberSticker(sticker("bbbbb"));
    rememberSticker(sticker("aaaaa"));
    expect(readRecentStickers().map((s) => s.stickerId)).toEqual(["giphy:aaaaa", "giphy:bbbbb"]);
  });

  it("keeps only the latest few", () => {
    for (let i = 0; i < MAX_RECENT_STICKERS + 5; i++) rememberSticker(sticker(`id${String(i).padStart(5, "0")}`));
    const list = readRecentStickers();
    expect(list).toHaveLength(MAX_RECENT_STICKERS);
    expect(list[0].stickerId).toBe(`giphy:id${String(MAX_RECENT_STICKERS + 4).padStart(5, "0")}`);
  });

  it("treats damaged storage as empty and drops entries that are not stickers", () => {
    window.localStorage.setItem(RECENT_STICKERS_KEY, "{not json");
    expect(readRecentStickers()).toEqual([]);
    window.localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify([sticker("aaaaa"), { stickerId: 1 }, null]));
    expect(readRecentStickers().map((s) => s.stickerId)).toEqual(["giphy:aaaaa"]);
  });
});

describe("sticker categories", () => {
  it("have unique ids, and only trending has a blank query", () => {
    expect(new Set(STICKER_CATEGORIES.map((c) => c.id)).size).toBe(STICKER_CATEGORIES.length);
    expect(STICKER_CATEGORIES.filter((c) => c.query === "").map((c) => c.id)).toEqual(["trending"]);
  });
});
