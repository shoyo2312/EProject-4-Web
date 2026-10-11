import { describe, expect, it } from "vitest";

import { SEARCH_MAX_LENGTH } from "@/lib/api/search";
import { suggestionTerms } from "@/lib/search-suggestions";

describe("suggestionTerms", () => {
  it("keeps the chart's order and drops blanks and case-insensitive repeats", () => {
    expect(
      suggestionTerms(["Night market", "  ", "video", "VIDEO", "night  market", "Street food"], 8),
    ).toEqual(["Night market", "video", "Street food"]);
  });

  it("stops at the limit", () => {
    expect(suggestionTerms(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });

  it("flattens a multi-line title and cuts it to what search accepts", () => {
    const [term] = suggestionTerms([`Saigon\nby night ${"x".repeat(300)}`], 1);
    expect(term.startsWith("Saigon by night")).toBe(true);
    expect(term).toHaveLength(SEARCH_MAX_LENGTH);
  });
});
