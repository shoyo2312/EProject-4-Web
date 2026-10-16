import { SEARCH_MAX_LENGTH } from "@/lib/api/search";

/**
 * The search panel's "You may like" terms, out of the trending videos' titles:
 * rank order kept, whitespace collapsed, cut to what the search box accepts,
 * and blanks and repeats (ignoring case) dropped — a small library has plenty
 * of videos all called "video".
 */
export function suggestionTerms(titles: string[], limit: number): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];
  for (const title of titles) {
    const term = title.replace(/\s+/g, " ").trim().slice(0, SEARCH_MAX_LENGTH).trim();
    const key = term.toLowerCase();
    if (!term || seen.has(key)) continue;
    seen.add(key);
    terms.push(term);
    if (terms.length === limit) break;
  }
  return terms;
}
