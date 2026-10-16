import { describe, expect, it } from "vitest";

import { keywordKey } from "@/lib/comments/keyword-key";

/**
 * Each case is what moderation-lib's `Blocklist.keyOf` answers for the same
 * keyword: two keywords the server keys alike are one keyword there.
 */
describe("keywordKey", () => {
  it("ignores case and spacing, and keeps diacritics", () => {
    expect(keywordKey("Nhà  Cái")).toBe("nhà cái");
    expect(keywordKey("nha cai")).toBe("nha cai");
    expect(keywordKey("tạch")).not.toBe(keywordKey("tach"));
  });

  it("reads a letter repeated three times or more once, but keeps doubles", () => {
    expect(keywordKey("hayyy")).toBe("hay");
    expect(keywordKey("nguuuu")).toBe("ngu");
    expect(keywordKey("xoong")).toBe("xoong");
  });

  it("reads digits and symbols inside a word as the letters they stand for", () => {
    expect(keywordKey("SP0ILER")).toBe("spoiler");
    expect(keywordKey("a1")).toBe("ai");
    expect(keywordKey("c@c")).toBe("cac");
    expect(keywordKey("d1t m3")).toBe("dit me");
  });

  it("keeps a number a number, and a symbol outside a word punctuation", () => {
    expect(keywordKey("2026")).toBe("2026");
    expect(keywordKey("@minh")).toBe("minh");
    expect(keywordKey("hay!")).toBe("hay");
  });

  it("undoes full-width letters, look-alikes and marks nobody sees", () => {
    expect(keywordKey("ｓｐｏｉｌｅｒ")).toBe("spoiler");
    // Cyrillic с and а.
    expect(keywordKey("сас")).toBe("cac");
    // Icelandic Ð and African Ɖ, both drawn as Đ.
    expect(keywordKey("ÐM")).toBe("đm");
    expect(keywordKey("Ɖịt")).toBe("địt");
    expect(keywordKey("lồn︎")).toBe("lồn");
    expect(keywordKey("l̲ồ̲n̲")).toBe("lồn");
    expect(keywordKey("z​ero")).toBe("zero");
  });

  it("is empty when nothing in the keyword could match", () => {
    expect(keywordKey("!!!")).toBe("");
    expect(keywordKey("😀 ok")).toBe("ok");
  });
});
