import { beforeEach, describe, expect, it } from "vitest";

import {
  DISMISS_LIMIT,
  MUTE_MS,
  SUGGESTION_MUTE_KEY,
  compileTopics,
  isSuggestionMuted,
  matchSuggestionTopic,
  normalizeForMatch,
  recordSuggestionDismissed,
  recordSuggestionUsed,
} from "@/lib/chat-sticker-suggestions";

const topics = compileTopics([
  { id: "happy", keywords: ["vui", "vui vẻ"], patterns: ["^(ha){2,}h?$", "^(hi){2,}$"] },
  { id: "sad", keywords: ["buồn", "khóc"], patterns: ["^(hu){2,}$"] },
  { id: "sleepy", keywords: ["ngủ ngon", "buồn ngủ", "đi ngủ"], patterns: [] },
  { id: "hello", keywords: ["chào", "xin chào", "hi"], patterns: [] },
  { id: "love", keywords: ["nhớ em", "yêu"], patterns: [] },
]);

describe("normalizeForMatch", () => {
  it("drops case, diacritics and punctuation, and folds đ", () => {
    expect(normalizeForMatch("  Buồn   NGỦ!! ")).toBe("buon ngu");
    expect(normalizeForMatch("Đi ngủ…")).toBe("di ngu");
  });
});

describe("matchSuggestionTopic", () => {
  it("finds a listed word, with or without marks and punctuation", () => {
    expect(matchSuggestionTopic("vui", topics)).toBe("happy");
    expect(matchSuggestionTopic("Vui!", topics)).toBe("happy");
    expect(matchSuggestionTopic("buon", topics)).toBe("sad");
    expect(matchSuggestionTopic("  khóc  ", topics)).toBe("sad");
  });

  it("finds a word inside a short message, up to three words", () => {
    expect(matchSuggestionTopic("hôm nay vui", topics)).toBe("happy");
    expect(matchSuggestionTopic("nhớ em", topics)).toBe("love");
  });

  it("offers nothing for a sentence", () => {
    expect(matchSuggestionTopic("mai đi ăn vui", topics)).toBeNull();
    expect(matchSuggestionTopic("hôm nay mình vui lắm luôn", topics)).toBeNull();
    expect(matchSuggestionTopic("vui".padEnd(40, "a"), topics)).toBeNull();
  });

  it("offers nothing for everyday words and for empty text", () => {
    for (const text of ["ok", "ừ", "ngu", "đi", "không", "mai gặp", "", "   ", "!!!"]) {
      expect(matchSuggestionTopic(text, topics)).toBeNull();
    }
  });

  it("matches whole words, not pieces of them", () => {
    expect(matchSuggestionTopic("this", topics)).toBeNull();
    expect(matchSuggestionTopic("vuive", topics)).toBeNull();
    expect(matchSuggestionTopic("hi", topics)).toBe("hello");
  });

  it("prefers the longest match", () => {
    expect(matchSuggestionTopic("buồn ngủ", topics)).toBe("sleepy");
    expect(matchSuggestionTopic("xin chào", topics)).toBe("hello");
    expect(matchSuggestionTopic("hihi", topics)).toBe("happy");
  });

  it("matches a laugh however long, and only a laugh", () => {
    expect(matchSuggestionTopic("hahaha", topics)).toBe("happy");
    expect(matchSuggestionTopic("haha", topics)).toBe("happy");
    expect(matchSuggestionTopic("huhuhu", topics)).toBe("sad");
    expect(matchSuggestionTopic("ha", topics)).toBeNull();
    expect(matchSuggestionTopic("hahahaha nữa", topics)).toBe("happy");
  });

  it("ignores a pattern that does not compile instead of failing", () => {
    const broken = compileTopics([{ id: "x", keywords: ["vui"], patterns: ["(unclosed"] }]);
    expect(matchSuggestionTopic("vui", broken)).toBe("x");
  });
});

describe("silencing suggestions", () => {
  const NOW = 1_700_000_000_000;

  beforeEach(() => window.localStorage.clear());

  it("starts out not silenced", () => {
    expect(isSuggestionMuted("c1", NOW)).toBe(false);
  });

  it("silences a conversation for a day after two closes in a row, and only that conversation", () => {
    expect(DISMISS_LIMIT).toBe(2);
    expect(recordSuggestionDismissed("c1", NOW)).toBe(false);
    expect(isSuggestionMuted("c1", NOW)).toBe(false);

    expect(recordSuggestionDismissed("c1", NOW + 1000)).toBe(true);
    expect(isSuggestionMuted("c1", NOW + 2000)).toBe(true);
    expect(isSuggestionMuted("c2", NOW + 2000)).toBe(false);
  });

  it("lets suggestions back after the day, and counts from nothing again", () => {
    recordSuggestionDismissed("c1", NOW);
    recordSuggestionDismissed("c1", NOW + 1);

    expect(isSuggestionMuted("c1", NOW + MUTE_MS)).toBe(true);
    expect(isSuggestionMuted("c1", NOW + 1 + MUTE_MS)).toBe(false);

    expect(recordSuggestionDismissed("c1", NOW + MUTE_MS + 10)).toBe(false);
    expect(isSuggestionMuted("c1", NOW + MUTE_MS + 10)).toBe(false);
  });

  it("starts the count over when a suggested sticker is sent", () => {
    recordSuggestionDismissed("c1", NOW);
    recordSuggestionUsed("c1", NOW + 1);

    expect(recordSuggestionDismissed("c1", NOW + 2)).toBe(false);
    expect(isSuggestionMuted("c1", NOW + 3)).toBe(false);
  });

  it("does not lift a silence that is running when a sticker is sent", () => {
    recordSuggestionDismissed("c1", NOW);
    recordSuggestionDismissed("c1", NOW + 1);
    recordSuggestionUsed("c1", NOW + 2);

    expect(isSuggestionMuted("c1", NOW + 3)).toBe(true);
  });

  it("reads damaged storage as nothing", () => {
    window.localStorage.setItem(SUGGESTION_MUTE_KEY, "{not json");
    expect(isSuggestionMuted("c1", NOW)).toBe(false);
    window.localStorage.setItem(SUGGESTION_MUTE_KEY, JSON.stringify({ c1: { dismissed: "x" }, c2: null, c3: [] }));
    expect(isSuggestionMuted("c1", NOW)).toBe(false);
    expect(recordSuggestionDismissed("c1", NOW)).toBe(false);
  });

  it("keeps only the conversations that still matter, and a bounded number of them", () => {
    for (let i = 0; i < 250; i++) recordSuggestionDismissed(`c${i}`, NOW);

    const stored = JSON.parse(window.localStorage.getItem(SUGGESTION_MUTE_KEY) ?? "{}") as Record<string, unknown>;
    expect(Object.keys(stored).length).toBeLessThanOrEqual(200);
    expect(stored.c249).toBeDefined();

    recordSuggestionDismissed("old", NOW);
    recordSuggestionUsed("old", NOW);
    expect(JSON.parse(window.localStorage.getItem(SUGGESTION_MUTE_KEY) ?? "{}")).not.toHaveProperty("old");
  });
});
