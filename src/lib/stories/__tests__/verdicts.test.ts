import { describe, expect, it } from "vitest";

import type { StoryGroup, StoryResponse, StoryStatus } from "@/lib/api/types";
import { decidedSince } from "@/lib/stories/verdicts";

function story(id: string, userId: string, status: StoryStatus): StoryResponse {
  return {
    id,
    userId,
    mediaUrl: null,
    mediaType: "IMAGE",
    caption: null,
    visibility: "PUBLIC",
    status,
    durationSeconds: null,
    viewCount: 0,
    viewedByMe: false,
    myReaction: null,
    reactionCounts: null,
    createdAt: "2026-10-20T10:00:00Z",
    expiresAt: "2026-10-21T10:00:00Z",
  };
}
const group = (userId: string, stories: StoryResponse[]): StoryGroup => ({ userId, stories, hasUnseen: false });
const pending = (id: string, userId = "1") => story(id, userId, "PENDING_MODERATION");
const active = (id: string, userId = "1") => story(id, userId, "ACTIVE");

describe("decidedSince", () => {
  it("reports a story that went from pending to active, once, by id", () => {
    const before = [group("1", [pending("a"), pending("b")])];
    const after = [group("1", [active("a"), pending("b")])];

    expect(decidedSince(before, after, "1")).toEqual({ live: [active("a")], hidden: [] });
  });

  it("reports held and rejected as hidden", () => {
    const before = [group("1", [pending("a"), pending("b")])];
    const held = story("a", "1", "HELD");
    const rejected = story("b", "1", "REJECTED");

    expect(decidedSince(before, [group("1", [held, rejected])], "1")).toEqual({ live: [], hidden: [held, rejected] });
  });

  it("ignores other owners and stories that were not pending before", () => {
    const before = [group("1", [active("a")]), group("2", [pending("x", "2")])];
    const after = [group("1", [active("a")]), group("2", [active("x", "2")])];

    expect(decidedSince(before, after, "1")).toEqual({ live: [], hidden: [] });
  });
});
