import { describe, expect, it } from "vitest";

import { ApiError } from "@/lib/api/errors";
import {
  CHAT_REPORT_REASONS,
  REPORT_MAX_MESSAGES,
  reportErrorMessage,
  toggleSelection,
} from "@/lib/chat-report";

describe("toggleSelection", () => {
  it("ticks and unticks one message", () => {
    const { next } = toggleSelection(new Set(), "1");
    expect([...next]).toEqual(["1"]);
    expect(toggleSelection(next, "1").next.size).toBe(0);
  });

  it("accepts the 50th message and refuses the 51st without dropping any", () => {
    let selected: ReadonlySet<string> = new Set();
    for (let i = 1; i <= REPORT_MAX_MESSAGES; i++) selected = toggleSelection(selected, String(i)).next;
    expect(selected.size).toBe(50);

    const over = toggleSelection(selected, "51");
    expect(over.full).toBe(true);
    expect(over.next).toBe(selected);
    expect(over.next.has("1")).toBe(true);
  });

  it("can untick when full", () => {
    const full = new Set(Array.from({ length: 50 }, (_, i) => String(i)));
    const { next, full: refused } = toggleSelection(full, "0");
    expect(refused).toBe(false);
    expect(next.size).toBe(49);
  });

  it("keeps Snowflake ids as strings", () => {
    const id = "9007199254740993123";
    expect(toggleSelection(new Set(), id).next.has(id)).toBe(true);
  });
});

describe("reasons", () => {
  it("offers the eighteen labels once each", () => {
    expect(new Set(CHAT_REPORT_REASONS).size).toBe(18);
    expect(CHAT_REPORT_REASONS).toContain("Sextortion and intimate image abuse");
  });
});

describe("reportErrorMessage", () => {
  it("explains a refusal of the evidence and falls back otherwise", () => {
    const refused = new ApiError(409, "REPORT_EVIDENCE_UNAVAILABLE", "x");
    expect(reportErrorMessage(refused)).toMatch(/no longer be reported/);
    expect(reportErrorMessage(new Error("boom"))).toMatch(/Couldn't send/);
  });
});
