import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearDraft,
  draftPreview,
  draftsSnapshot,
  flushDrafts,
  getDraft,
  resetDraftsForTest,
  saveDraft,
  subscribeDrafts,
} from "@/lib/chat-drafts";

const KEY = (user: string) => `tt:chat-drafts:v1:${user}`;

beforeEach(() => {
  vi.useFakeTimers();
  window.localStorage.clear();
  resetDraftsForTest();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("chat drafts", () => {
  it("keeps a separate draft for each conversation", () => {
    saveDraft("u1", "A", "abc");
    saveDraft("u1", "B", "hello");
    expect(getDraft("u1", "A")).toBe("abc");
    expect(getDraft("u1", "B")).toBe("hello");
    expect(getDraft("u1", "C")).toBe("");
  });

  it("keeps accounts apart", () => {
    saveDraft("u1", "A", "abc");
    expect(getDraft("u2", "A")).toBe("");
    expect(draftsSnapshot("u2")).toEqual({});
  });

  it("does not write storage on every change, only after a pause", () => {
    saveDraft("u1", "A", "a");
    saveDraft("u1", "A", "ab");
    saveDraft("u1", "A", "abc");
    expect(window.localStorage.getItem(KEY("u1"))).toBeNull();
    vi.advanceTimersByTime(400);
    expect(JSON.parse(window.localStorage.getItem(KEY("u1")) ?? "{}")).toEqual({ A: "abc" });
  });

  it("flushes at once on request, so leaving a thread loses nothing", () => {
    saveDraft("u1", "A", "abc");
    flushDrafts();
    expect(JSON.parse(window.localStorage.getItem(KEY("u1")) ?? "{}")).toEqual({ A: "abc" });
  });

  it("survives a reload (memory dropped, storage kept)", () => {
    saveDraft("u1", "A", "abc");
    flushDrafts();
    resetDraftsForTest();
    expect(getDraft("u1", "A")).toBe("abc");
  });

  it("removes the draft when the text is emptied or only whitespace", () => {
    saveDraft("u1", "A", "abc");
    saveDraft("u1", "A", "   \n");
    expect(getDraft("u1", "A")).toBe("");
    flushDrafts();
    expect(window.localStorage.getItem(KEY("u1"))).toBeNull();
  });

  it("clearDraft removes only that conversation", () => {
    saveDraft("u1", "A", "abc");
    saveDraft("u1", "B", "hello");
    clearDraft("u1", "A");
    expect(getDraft("u1", "A")).toBe("");
    expect(getDraft("u1", "B")).toBe("hello");
  });

  it("changes the snapshot identity and notifies only on a real change", () => {
    const listener = vi.fn();
    const off = subscribeDrafts(listener);
    saveDraft("u1", "A", "abc");
    const first = draftsSnapshot("u1");
    saveDraft("u1", "A", "abc");
    clearDraft("u1", "Z");
    expect(draftsSnapshot("u1")).toBe(first);
    expect(listener).toHaveBeenCalledTimes(1);
    saveDraft("u1", "A", "abcd");
    expect(draftsSnapshot("u1")).not.toBe(first);
    off();
    saveDraft("u1", "A", "x");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("ignores corrupt or foreign storage content", () => {
    window.localStorage.setItem(KEY("u1"), "{not json");
    expect(getDraft("u1", "A")).toBe("");
    window.localStorage.setItem(KEY("u2"), JSON.stringify({ A: 5, B: "ok", C: "  " }));
    expect(draftsSnapshot("u2")).toEqual({ B: "ok" });
  });

  it("picks up another tab's write through the storage event", () => {
    const listener = vi.fn();
    subscribeDrafts(listener);
    expect(getDraft("u1", "A")).toBe("");
    window.localStorage.setItem(KEY("u1"), JSON.stringify({ A: "from tab 2" }));
    window.dispatchEvent(new StorageEvent("storage", { key: KEY("u1") }));
    expect(listener).toHaveBeenCalled();
    expect(getDraft("u1", "A")).toBe("from tab 2");
  });

  it("stores no draft without a signed-in account", () => {
    saveDraft("", "A", "abc");
    expect(getDraft("", "A")).toBe("");
  });
});

describe("draftPreview", () => {
  it("collapses line breaks and runs of spaces", () => {
    expect(draftPreview("  hello \n\n  world  ")).toBe("hello world");
  });

  it("cuts a very long draft without splitting an emoji", () => {
    const out = draftPreview("😀".repeat(500));
    expect(Array.from(out).length).toBe(121);
    expect(out.endsWith("…")).toBe(true);
  });
});
