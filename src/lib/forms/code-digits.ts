export const CODE_LENGTH = 6;

/**
 * What typing into one of the six code boxes does to the whole code.
 *
 * `typed` is the box's new raw value, which is more than one character when a
 * digit is typed over an existing one or a whole code is pasted. Every digit in
 * it is written from `index` onwards, so pasting "123456" into the first box
 * fills all six, and the caret moves to the box after the last one written.
 * An empty `typed` clears just that box and leaves the caret where it is.
 */
export function enterDigits(
  digits: readonly string[],
  index: number,
  typed: string,
): { digits: string[]; focus: number } {
  const next = [...digits];
  const incoming = typed.replace(/\D/g, "");

  if (!incoming) {
    next[index] = "";
    return { digits: next, focus: index };
  }

  // Typing into a filled box gives the old digit plus the new one, on
  // whichever side of the old one the caret was.
  const old = digits[index];
  let written = incoming;
  if (incoming.length === 2 && old) {
    if (incoming.startsWith(old)) written = incoming.slice(1);
    else if (incoming.endsWith(old)) written = incoming.slice(0, 1);
  }

  let cursor = index;
  for (const digit of written) {
    if (cursor >= CODE_LENGTH) break;
    next[cursor] = digit;
    cursor += 1;
  }

  return { digits: next, focus: Math.min(cursor, CODE_LENGTH - 1) };
}

export function emptyCode(): string[] {
  return Array.from({ length: CODE_LENGTH }, () => "");
}
