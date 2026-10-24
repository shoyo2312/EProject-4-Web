import { describe, expect, it } from "vitest";

import { SETTINGS_SECTIONS } from "@/lib/site-config";

const rows = SETTINGS_SECTIONS.flatMap((s) => s.groups.flatMap((g) => g.rows));

describe("SETTINGS_SECTIONS", () => {
  it("drops the removed rows", () => {
    expect(SETTINGS_SECTIONS.map((s) => s.id)).not.toContain("business-verification");
    expect(rows.map((r) => r.title)).not.toContain("Account region");
    expect(rows.map((r) => r.title)).not.toContain("Digital well-being tips");
    expect(SETTINGS_SECTIONS.flatMap((s) => s.groups.map((g) => g.heading))).not.toContain(
      "Help and resources",
    );
  });

  it("has no mentions in Interactions", () => {
    expect(rows.find((r) => r.title === "Interactions")?.description).toBe(
      "Likes, comments, new followers",
    );
  });
});
