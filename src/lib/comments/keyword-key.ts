/**
 * A creator's filter keyword as the server's matcher keys it — a port of
 * moderation-lib's `Blocklist.keyOf` (`TextNormalizer`, accented form). Two
 * keywords with one key are one keyword to user-service, which drops the
 * repeat without a word; the settings form refuses it up front instead, so it
 * has to read keywords exactly the way the server does:
 *
 * - NFKC, lower case, combining marks left loose dropped, look-alikes read as
 *   the letter they pass for: Cyrillic and Greek twins of Latin letters, and
 *   `ð`/`ɖ` (the lower case of `Ð`/`Ɖ`, both drawn as `Đ`) as `đ`;
 * - split into syllables on anything not a letter or digit — `@ $ !` between
 *   two letters stay inside one;
 * - inside a syllable with letters, digits and those symbols read as letters
 *   (`sp0iler`), and a letter three times or more in a row read once (`hayyy`).
 *
 * Diacritics are kept: "nhà cái" and "nha cai" match differently, so they are
 * two keywords. Empty when nothing in the keyword could ever match.
 */
export function keywordKey(term: string): string {
  return syllables(prepare(term))
    .map((syllable) => squeeze(decodeLeet(syllable)))
    .join(" ");
}

const LOOK_ALIKES = pairs(
  "аa еe ёe оo рp сc уy хx кk мm іi јj ѕs ԁd ӏl һh ԛq ԝw αa οo εe ιi κk νv ρp τt υu χx γy ðđ ɖđ",
);
const LEET = pairs("0o 1i 3e 4a 5s 7t @a $s !i");
/** The leet symbols that are not word parts already, unlike its digits. */
const LEET_SYMBOLS = new Set(["@", "$", "!"]);
const MIN_SQUEEZED_RUN = 3;

const LETTER = /\p{L}/u;
const WORD_PART = /[\p{L}\p{Nd}\p{Mc}]/u;

function prepare(term: string): string {
  return [...term.normalize("NFKC").toLowerCase()]
    // Format characters are what the server's sanitizer drops before keying.
    .filter((char) => !/[\p{Mn}\p{Me}\p{Cf}]/u.test(char))
    .map((char) => LOOK_ALIKES.get(char) ?? char)
    .join("");
}

function syllables(text: string): string[] {
  const chars = [...text];
  const found: string[] = [];
  let current: string[] = [];
  chars.forEach((char, i) => {
    if (WORD_PART.test(char)) {
      current.push(char);
    } else if (
      LEET_SYMBOLS.has(char) &&
      current.length > 0 &&
      LETTER.test(current[current.length - 1]) &&
      i + 1 < chars.length &&
      LETTER.test(chars[i + 1])
    ) {
      current.push(char);
    } else if (current.length > 0) {
      found.push(current.join(""));
      current = [];
    }
  });
  if (current.length > 0) found.push(current.join(""));
  return found;
}

function decodeLeet(syllable: string): string {
  const chars = [...syllable];
  if (!chars.some((char) => LETTER.test(char))) return syllable;
  return chars.map((char) => LEET.get(char) ?? char).join("");
}

function squeeze(syllable: string): string {
  const chars = [...syllable];
  let out = "";
  let i = 0;
  while (i < chars.length) {
    let run = 1;
    while (i + run < chars.length && chars[i + run] === chars[i]) run++;
    out += chars[i].repeat(run >= MIN_SQUEEZED_RUN ? 1 : run);
    i += run;
  }
  return out;
}

function pairs(list: string): Map<string, string> {
  return new Map(
    list.split(" ").map((pair) => {
      const [from, to] = [...pair];
      return [from, to];
    }),
  );
}
