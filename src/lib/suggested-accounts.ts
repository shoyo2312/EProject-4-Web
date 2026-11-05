import type { SuggestionReason } from "@/lib/api/types";

/** Cards the profile row shows. The hook asks for one more, to cover dropping the profile's owner. */
export const SUGGESTED_ACCOUNTS_LIMIT = 20;

/** The line under a suggested account's name. */
export function reasonLabel(reason: SuggestionReason, followedBy: string | null): string {
  if (reason === "FOLLOWS_YOU") return "Follows you";
  if (reason === "FOLLOWED_BY" && followedBy) return `Followed by ${followedBy}`;
  return "Suggested for you";
}

/** Which ends of a horizontal scroller are reached, within a 1px tolerance; drives the arrows and the fade. */
export function scrollEdges(
  scrollLeft: number,
  clientWidth: number,
  scrollWidth: number,
): { atStart: boolean; atEnd: boolean } {
  return {
    atStart: scrollLeft <= 1,
    atEnd: scrollLeft + clientWidth >= scrollWidth - 1,
  };
}
