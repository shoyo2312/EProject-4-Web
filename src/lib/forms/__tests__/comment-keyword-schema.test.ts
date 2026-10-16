import { describe, expect, it } from "vitest";

import { COMMENT_KEYWORDS_MAX, commentKeywordSchemaFor } from "../schemas";

/** The keyword field's message, or null when the keyword passes. */
function problem(keyword: string, existing: string[] = []): string | null {
  const result = commentKeywordSchemaFor(existing).safeParse({ keyword });
  return result.success ? null : (result.error.issues[0]?.message ?? null);
}

describe("commentKeywordSchemaFor", () => {
  it("takes a new keyword, accents and all", () => {
    expect(problem("giảm giá", ["spoiler"])).toBeNull();
  });

  it("asks for something when the box is blank", () => {
    expect(problem("   ")).toBe("Enter a keyword.");
  });

  it("counts length in code points, as the server does", () => {
    expect(problem("😀".repeat(29) + "a")).toBeNull();
    expect(problem("a".repeat(31))).toBe("Keywords can be at most 30 characters.");
  });

  it("refuses a keyword with nothing the filter could match", () => {
    expect(problem("!!! 😀")).toBe("Keywords need a letter or a number.");
  });

  it("refuses a keyword already on the list, whatever its case or spacing", () => {
    expect(problem("nhà  CÁI", ["Nhà Cái"])).toBe("You already filter this keyword.");
  });

  /** The server would drop these without a word: it reads them as the one already listed. */
  it("refuses a keyword the server's matcher reads as one already listed", () => {
    expect(problem("hayyy", ["hay"])).toBe("You already filter this keyword.");
    expect(problem("SP0ILER", ["spoiler"])).toBe("You already filter this keyword.");
  });

  it("keeps an unaccented spelling apart from the accented one", () => {
    expect(problem("nha cai", ["Nhà Cái"])).toBeNull();
  });

  it("stops at the server's cap", () => {
    const full = Array.from({ length: COMMENT_KEYWORDS_MAX }, (_, i) => `word${i}`);
    expect(problem("one more", full)).toBe(
      `You can filter up to ${COMMENT_KEYWORDS_MAX} keywords.`,
    );
  });
});
