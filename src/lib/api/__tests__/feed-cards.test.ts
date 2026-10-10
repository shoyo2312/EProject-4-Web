import { describe, expect, it, vi } from "vitest";

import type { VideoResponse } from "@/lib/api/types";

const resolveAuthors = vi.fn();
vi.mock("@/lib/api/authors", () => ({
  resolveAuthors: (ids: string[]) => resolveAuthors(ids),
}));

const { toFeedCards } = await import("@/lib/api/feed-cards");

const row = (id: string) => ({ id, userId: "1" }) as VideoResponse;

describe("toFeedCards", () => {
  it("never hands the same video to two calls running at once", async () => {
    resolveAuthors.mockResolvedValue(new Map());
    const seen = new Set<string>();

    const [first, second] = await Promise.all([
      toFeedCards([row("a"), row("b")], seen),
      toFeedCards([row("b"), row("c")], seen),
    ]);

    expect([...first, ...second].map((card) => card.id)).toEqual(["a", "b", "c"]);
  });

  it("lets a failed batch be shown on retry", async () => {
    resolveAuthors.mockRejectedValueOnce(new Error("down")).mockResolvedValue(new Map());
    const seen = new Set<string>();

    await expect(toFeedCards([row("a")], seen)).rejects.toThrow("down");
    await expect(toFeedCards([row("a")], seen)).resolves.toHaveLength(1);
  });
});
