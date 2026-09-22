import { describe, expect, it } from "vitest";

import { pickSuggestedCreators } from "@/lib/creators/suggested";
import type { VideoResponse } from "@/lib/api/types";
import type { Author } from "@/types/tiktok";

function video(id: string, userId: string): VideoResponse {
  return {
    id,
    userId,
    thumbnailUrl: `/poster-${id}.jpg`,
    hlsUrl: `/video-${id}.m3u8`,
  } as VideoResponse;
}

function author(userId: string): Author {
  return {
    userId,
    username: userId,
    nickname: `user${userId}`,
    avatarUrl: "/avatar.png",
  };
}

const authors = new Map(["1", "2", "3"].map((id) => [id, author(id)]));

describe("pickSuggestedCreators", () => {
  it("keeps one card per creator, covered by their newest video", () => {
    const cards = pickSuggestedCreators(
      [video("a", "1"), video("b", "1"), video("c", "2")],
      authors,
    );

    expect(cards.map((card) => card.id)).toEqual(["1", "2"]);
    expect(cards[0].posterUrl).toBe("/poster-a.jpg");
  });

  it("skips excluded creators and those with no resolved author", () => {
    const cards = pickSuggestedCreators(
      [video("a", "1"), video("b", "2"), video("c", "9")],
      authors,
      { exclude: ["1"] },
    );

    expect(cards.map((card) => card.id)).toEqual(["2"]);
  });

  it("stops at the limit", () => {
    const cards = pickSuggestedCreators(
      [video("a", "1"), video("b", "2"), video("c", "3")],
      authors,
      { limit: 2 },
    );

    expect(cards).toHaveLength(2);
  });
});
