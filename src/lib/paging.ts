/**
 * The next page added to what is already shown, minus anything shown already.
 * Offset paging over a list that is still growing — a creator posting while
 * the reader scrolls — hands back the row that was last on the previous page,
 * and two tiles with one key is a React warning and a duplicate on screen.
 */
export function appendUnique<T extends { id: string }>(current: readonly T[], page: readonly T[]): T[];
/** Keyed by something other than `id` — a comment's `commentId`. */
export function appendUnique<T>(current: readonly T[], page: readonly T[], key: (item: T) => string): T[];
export function appendUnique<T>(
  current: readonly T[],
  page: readonly T[],
  key: (item: T) => string = (item) => (item as { id: string }).id,
): T[] {
  const seen = new Set(current.map(key));
  return [...current, ...page.filter((item) => !seen.has(key(item)))];
}
