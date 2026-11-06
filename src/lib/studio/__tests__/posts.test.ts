import { describe, expect, it } from "vitest";

import { insertToken, nextSort, pinnedFirst, videoFileName } from "@/lib/studio/posts";

describe("insertToken", () => {
  it("puts the token at the caret and moves the caret past it", () => {
    expect(insertToken("video_31", 8, 8, "#")).toEqual({ text: "video_31#", caret: 9 });
    expect(insertToken("ab", 1, 1, "@")).toEqual({ text: "a@b", caret: 2 });
  });

  it("replaces a selection", () => {
    expect(insertToken("hello world", 6, 11, "#")).toEqual({ text: "hello #", caret: 7 });
  });
});

describe("videoFileName", () => {
  it("keeps the title, minus what a file name cannot hold", () => {
    expect(videoFileName('My trip: day 1?  "best"', "42")).toBe("My trip day 1 best.mp4");
    expect(videoFileName("Đi biển Vũng Tàu", "42")).toBe("Đi biển Vũng Tàu.mp4");
  });

  it("falls back to the id when nothing usable is left", () => {
    expect(videoFileName(" /?* ", "42")).toBe("42.mp4");
  });
});

describe("nextSort", () => {
  it("starts a column high to low, then flips it back and forth", () => {
    const first = nextSort(undefined, "VIEWS");
    expect(first).toEqual({ key: "VIEWS", order: "DESC" });
    const second = nextSort(first, "VIEWS");
    expect(second).toEqual({ key: "VIEWS", order: "ASC" });
    expect(nextSort(second, "VIEWS")).toEqual({ key: "VIEWS", order: "DESC" });
  });

  it("starts another column high to low whatever the last one was", () => {
    expect(nextSort({ key: "VIEWS", order: "ASC" }, "LIKES")).toEqual({ key: "LIKES", order: "DESC" });
  });
});

describe("pinnedFirst", () => {
  it("moves pinned items ahead and keeps the ranking inside each group", () => {
    const rows = [
      { id: "a", pinnedAt: null },
      { id: "b", pinnedAt: "2026-11-01T00:00:00Z" },
      { id: "c", pinnedAt: undefined },
      { id: "d", pinnedAt: "2026-10-01T00:00:00Z" },
    ];
    expect(pinnedFirst(rows, (row) => row.pinnedAt).map((row) => row.id)).toEqual(["b", "d", "a", "c"]);
    expect(rows.map((row) => row.id)).toEqual(["a", "b", "c", "d"]);
  });
});
