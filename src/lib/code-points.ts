/**
 * A text's length as the backend counts it — in Unicode code points, the unit
 * of every `@MaxCodePoints` limit. `String.length` and an input's `maxLength`
 * count UTF-16 units instead, where an emoji is two: a box held to them fills
 * at half the emoji the server would take.
 */
export function codePointLength(text: string): number {
  return [...text].length;
}

/**
 * The edit that turned `previous` into `next`, held to `max` code points the
 * way `maxLength` holds one: what was typed or pasted is cut to fit and the
 * text around it is left alone, so a keystroke at the cap does nothing. A
 * deletion always goes through.
 */
export function fitEdit(previous: string, next: string, max: number): string {
  const after = [...next];
  if (after.length <= max) return next;

  const before = [...previous];
  let start = 0;
  while (start < before.length && start < after.length && before[start] === after[start]) {
    start++;
  }
  let end = 0;
  while (
    end < before.length - start &&
    end < after.length - start &&
    before[before.length - 1 - end] === after[after.length - 1 - end]
  ) {
    end++;
  }
  const inserted = after.slice(start, after.length - end);
  const room = Math.max(0, max - (after.length - inserted.length));
  return [
    ...after.slice(0, start),
    ...inserted.slice(0, room),
    ...after.slice(after.length - end),
  ].join("");
}
