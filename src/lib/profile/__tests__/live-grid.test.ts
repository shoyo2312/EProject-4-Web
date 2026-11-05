import { describe, expect, it } from "vitest";

import type { VideoResponse } from "@/lib/api/types";
import { patchGrid } from "@/lib/profile/live-grid";
import type { ProfileVideo } from "@/types/tiktok";

const tile = (id: string, isPinned = false): ProfileVideo => ({ id, posterUrl: "", videoUrl: "", views: 0, isPinned, status: "PUBLISHED" });
const video = (id: string, extra: Partial<VideoResponse> = {}) =>
  ({ id, userId: "7", thumbnailUrl: null, hlsUrl: null, viewCount: 0, visibility: "PUBLIC", pinnedAt: null, status: "PUBLISHED", ...extra }) as VideoResponse;

describe("patchGrid", () => {
  const grid = [tile("1"), tile("2")];

  it("patches a tile in place when its order does not change", () => {
    const next = patchGrid(grid, "7", video("2", { visibility: "PRIVATE", viewCount: 9 }));

    expect(next).toEqual([tile("1"), { ...tile("2"), isPrivate: true, views: 9 }]);
  });

  it("asks for the grid again when a pin flips, since the server orders pinned videos first", () => {
    expect(patchGrid(grid, "7", video("2", { pinnedAt: "2026-11-05T00:00:00Z" }))).toBe("reload");
    expect(patchGrid([tile("1", true)], "7", video("1"))).toBe("reload");
  });

  it("asks again for the owner's video that is not loaded yet", () => {
    expect(patchGrid(grid, "7", video("9"))).toBe("reload");
  });

  it("leaves another account's grid alone", () => {
    expect(patchGrid(grid, "8", video("2", { pinnedAt: "2026-11-05T00:00:00Z" }))).toBeNull();
  });
});
