import type { KeywordFilterInput } from "@/lib/api/keyword-filters";

/** user-service's limit, in characters (code points). */
export const KEYWORD_MAX_LENGTH = 200;

/** The feeds a keyword can be filtered from, in the form's order. */
export const KEYWORD_FEEDS = [
  { field: "forYou", label: "For You" },
  { field: "following", label: "Following" },
  { field: "friends", label: "Friends" },
] as const;

export type KeywordFeeds = Omit<KeywordFilterInput, "keyword">;

/**
 * Why `text` cannot be saved, or null when it can. `existing` are the
 * account's other keywords; a match in any capitalization is a duplicate, as
 * user-service sees it.
 */
export function keywordError(text: string, existing: readonly string[]): string | null {
  // user-service trims and folds runs of spaces to one before it checks, so a phrase is compared that way.
  const keyword = text.trim().replace(/\s+/g, " ");
  if (!keyword) return "Enter a word, hashtag or phrase";
  if ([...keyword].length > KEYWORD_MAX_LENGTH) return "Keywords can be up to 200 characters";
  const lower = keyword.toLowerCase();
  if (existing.some((other) => other.toLowerCase() === lower)) {
    return "You've already added this keyword";
  }
  return null;
}

/** "For You, Friends" — a keyword's feeds, as its row in the list says them. */
export function feedsLabel(feeds: KeywordFeeds): string {
  return KEYWORD_FEEDS.filter(({ field }) => feeds[field])
    .map(({ label }) => label)
    .join(", ");
}
