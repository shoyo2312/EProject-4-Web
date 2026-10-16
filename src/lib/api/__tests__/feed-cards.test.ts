import { describe, expect, it, vi } from "vitest";

import type { VideoResponse } from "@/lib/api/types";

const resolveAuthors = vi.fn();
vi.mock("@/lib/api/authors", () => ({
  resolveAuthors: (ids: string[]) => resolveAuthors(ids),
}));

const getVideoCounts = vi.fn().mockResolvedValue([]);
vi.mock("@/lib/api/interactions", () => ({
  getVideoCounts: (ids: string[]) => getVideoCounts(ids),
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

  it("carries the share and save counts, and shows the cards without them", async () => {
    resolveAuthors.mockResolvedValue(new Map());
    getVideoCounts.mockResolvedValueOnce([{ videoId: "a", shareCount: 4, saveCount: 2 }]);

    const [card] = await toFeedCards([row("a")], new Set());
    expect(card.stats).toMatchObject({ shares: 4, bookmarks: 2 });

    getVideoCounts.mockRejectedValueOnce(new Error("down"));
    const [bare] = await toFeedCards([row("b")], new Set());
    expect(bare.stats).toMatchObject({ shares: 0, bookmarks: 0 });
  });
});
