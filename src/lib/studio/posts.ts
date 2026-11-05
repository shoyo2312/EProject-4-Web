import type { CountRange, SortOrder, StudioPostSort } from "@/lib/api/types";

/** The ranges under TikTok Studio's Views, Likes and Comments chips. */
export const COUNT_RANGES: { value: CountRange; label: string }[] = [
  { value: "UNDER_1K", label: "<1K" },
  { value: "FROM_1K_TO_10K", label: "1K–10K" },
  { value: "FROM_10K_TO_100K", label: "10K–100K" },
  { value: "OVER_100K", label: ">100K" },
];

export interface PostSort {
  key: StudioPostSort;
  order: SortOrder;
}

/**
 * A column header press, as on TikTok Studio: a new column starts high to low,
 * the same column flips, and there is no way back to "unsorted".
 */
export function nextSort(current: PostSort | undefined, key: StudioPostSort): PostSort {
  return { key, order: current?.key === key && current.order === "DESC" ? "ASC" : "DESC" };
}

/**
 * The caption box's "# Hashtags" / "@ Mention": `token` goes where the caret is,
 * replacing any selection, and the caret lands right after it.
 */
export function insertToken(
  text: string,
  start: number,
  end: number,
  token: string,
): { text: string; caret: number } {
  return { text: text.slice(0, start) + token + text.slice(end), caret: start + token.length };
}

/** "My trip: day 1?" → "My trip day 1.mp4"; the video id when nothing usable is left. */
export function videoFileName(title: string, videoId: string): string {
  const name = title
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80)
    .trim();
  return `${name || videoId}.mp4`;
}
