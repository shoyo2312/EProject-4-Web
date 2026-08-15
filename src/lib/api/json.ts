/**
 * JSON parsing that survives Snowflake ids.
 *
 * The backend sends account ids as JSON **numbers**: `"id": 346173853382643712`.
 * That is 18 digits — well past 2^53 — so `JSON.parse` rounds it to
 * 346173853382643700 without a word of complaint. Every call built from such an
 * id (`GET /users/{userId}`, follow, unfollow) would then address an account
 * that does not exist, and the only symptom is a 404 that looks like a missing
 * profile.
 *
 * So long integers are quoted before parsing and travel through the app as
 * strings. Video ids already arrive as strings for exactly this reason; this
 * gives user ids the same treatment.
 *
 * A regex over the whole document would also rewrite digits inside string
 * values, so the scan below tracks whether it is inside a string.
 */

/** Digits at or above this length cannot be represented exactly by a double. */
const UNSAFE_DIGITS = 16;

export function parseJsonPreservingIds<T>(text: string): T {
  return JSON.parse(quoteLongIntegers(text)) as T;
}

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function quoteLongIntegers(text: string): string {
  let out = "";
  let index = 0;
  let inString = false;

  while (index < text.length) {
    const char = text[index];

    if (inString) {
      // A backslash escapes the next character, including a closing quote.
      if (char === "\\") {
        out += char + (text[index + 1] ?? "");
        index += 2;
        continue;
      }
      if (char === '"') inString = false;
      out += char;
      index += 1;
      continue;
    }

    if (char === '"') {
      inString = true;
      out += char;
      index += 1;
      continue;
    }

    if (char === "-" || (char >= "0" && char <= "9")) {
      // The *whole* numeric literal is consumed, fraction and exponent
      // included. Stopping at the decimal point would leave the digits after
      // it looking like a number of their own, and quoting those would corrupt
      // the document rather than protect it.
      let end = index;
      if (text[end] === "-") end += 1;
      while (end < text.length && isDigit(text[end])) end += 1;

      const integerEnd = end;

      if (text[end] === ".") {
        end += 1;
        while (end < text.length && isDigit(text[end])) end += 1;
      }
      if (text[end] === "e" || text[end] === "E") {
        end += 1;
        if (text[end] === "+" || text[end] === "-") end += 1;
        while (end < text.length && isDigit(text[end])) end += 1;
      }

      const token = text.slice(index, end);
      const isInteger = end === integerEnd;
      const digits = token.startsWith("-") ? token.length - 1 : token.length;

      out += isInteger && digits >= UNSAFE_DIGITS ? `"${token}"` : token;
      index = end;
      continue;
    }

    out += char;
    index += 1;
  }

  return out;
}
