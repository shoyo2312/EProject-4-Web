import { describe, expect, it } from "vitest";

import { overviewMetrics } from "@/lib/studio/overview";

describe("overviewMetrics", () => {
  it("keeps the five metrics in TikTok's order with their days and the window before", () => {
    const metrics = overviewMetrics({
      current: { views: 12, likes: 3, comments: 1, shares: 0, netFollowers: 2 },
      previous: { views: 8, likes: 4, comments: 0, shares: 1, netFollowers: 0 },
      daily: [
        { day: "2026-10-01", views: 5, likes: 1, comments: 0, shares: 0, followersGained: 3, followersLost: 1 },
        { day: "2026-10-02", views: 7, likes: 2, comments: 1, shares: 0, followersGained: 0, followersLost: 0 },
      ],
    });

    expect(metrics.map((m) => m.label)).toEqual(["Video views", "Likes", "Comments", "Shares", "Net followers"]);
    expect(metrics[0]).toMatchObject({ value: 12, previous: 8, series: [5, 7] });
    expect(metrics[4].series).toEqual([2, 0]);
  });
});
