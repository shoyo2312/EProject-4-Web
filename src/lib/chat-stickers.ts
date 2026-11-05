import type { StickerView } from "@/lib/api/conversations";

/**
 * The picker's sticker sections, one per character. Each is a GIPHY search; a blank query asks for the
 * trending stickers. The emoji is the section's icon, so the strip costs no request of its own.
 */
export const STICKER_CATEGORIES = [
  { id: "trending", label: "Trending", emoji: "🔥", query: "" },
  { id: "bunny", label: "Bunny", emoji: "🐰", query: "cute bunny" },
  { id: "cat", label: "Cat", emoji: "🐱", query: "cute cat" },
  { id: "dog", label: "Dog", emoji: "🐶", query: "cute dog" },
  { id: "panda", label: "Panda", emoji: "🐼", query: "cute panda" },
  { id: "bear", label: "Bear", emoji: "🐻", query: "cute bear" },
  { id: "pig", label: "Pig", emoji: "🐷", query: "cute pig" },
  { id: "duck", label: "Duck", emoji: "🦆", query: "cute duck" },
  { id: "capybara", label: "Capybara", emoji: "🦫", query: "capybara" },
] as const;

export type StickerCategoryId = (typeof STICKER_CATEGORIES)[number]["id"];

export const RECENT_STICKERS_KEY = "tt.chat.recent-stickers.v1";
export const MAX_RECENT_STICKERS = 24;

function isSticker(value: unknown): value is StickerView {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.stickerId === "string" &&
    typeof v.name === "string" &&
    typeof v.url === "string" &&
    typeof v.width === "number" &&
    typeof v.height === "number"
  );
}

/** The stickers this browser sent most recently, newest first. Anything unreadable is treated as none. */
export function readRecentStickers(): StickerView[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_STICKERS_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter(isSticker).slice(0, MAX_RECENT_STICKERS) : [];
  } catch {
    return [];
  }
}

/** Puts `sticker` first, once, and keeps the list to its cap. Returns the new list even if saving fails. */
export function rememberSticker(sticker: StickerView): StickerView[] {
  const next = [sticker, ...readRecentStickers().filter((s) => s.stickerId !== sticker.stickerId)].slice(
    0,
    MAX_RECENT_STICKERS,
  );
  try {
    window.localStorage.setItem(RECENT_STICKERS_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full store: the list still works for this session.
  }
  return next;
}
