import { describe, expect, it } from "vitest";

import type { StoryGroup, StoryResponse } from "@/lib/api/types";

import { displayMs, firstUnseen, markStorySeen, next, previous } from "../navigation";

function story(id: string, overrides: Partial<StoryResponse> = {}): StoryResponse {
  return {
    id,
    userId: "1",
    mediaUrl: "https://media/" + id,
    mediaType: "IMAGE",
    caption: null,
    visibility: "PUBLIC",
    status: null,
    durationSeconds: null,
    viewCount: null,
    viewedByMe: false,
    createdAt: "2026-10-20T10:00:00Z",
    expiresAt: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

const groups: StoryGroup[] = [
  { userId: "1", stories: [story("a"), story("b")], hasUnseen: true },
  { userId: "2", stories: [story("c")], hasUnseen: true },
];

describe("next", () => {
  it("moves to the following story of the same owner", () => {
    expect(next(groups, { group: 0, story: 0 })).toEqual({ group: 0, story: 1 });
  });

  it("moves to the next owner's first story at the end of a group", () => {
    expect(next(groups, { group: 0, story: 1 })).toEqual({ group: 1, story: 0 });
  });

  it("ends after the last story of the last owner", () => {
    expect(next(groups, { group: 1, story: 0 })).toBeNull();
  });
});

describe("previous", () => {
  it("moves to the earlier story of the same owner", () => {
    expect(previous(groups, { group: 0, story: 1 })).toEqual({ group: 0, story: 0 });
  });

  it("moves to the previous owner's last story at the start of a group", () => {
    expect(previous(groups, { group: 1, story: 0 })).toEqual({ group: 0, story: 1 });
  });

  it("has nothing before the very first story", () => {
    expect(previous(groups, { group: 0, story: 0 })).toBeNull();
  });
});

describe("displayMs", () => {
  it("shows an image for five seconds", () => {
    expect(displayMs(story("a"))).toBe(5000);
  });

  it("shows a video for its own length", () => {
    expect(displayMs(story("v", { mediaType: "VIDEO", durationSeconds: 12 }))).toBe(12000);
  });

  it("falls back to fifteen seconds for a video of unknown length", () => {
    expect(displayMs(story("v", { mediaType: "VIDEO", durationSeconds: null }))).toBe(15000);
  });
});

describe("firstUnseen", () => {
  it("starts at the first story not yet viewed", () => {
    const group: StoryGroup = {
      userId: "1",
      stories: [story("a", { viewedByMe: true }), story("b"), story("c")],
      hasUnseen: true,
    };
    expect(firstUnseen(group)).toBe(1);
  });

  it("starts from the beginning when everything was seen", () => {
    const group: StoryGroup = {
      userId: "1",
      stories: [story("a", { viewedByMe: true })],
      hasUnseen: false,
    };
    expect(firstUnseen(group)).toBe(0);
  });
});

describe("markStorySeen", () => {
  it("marks the story and clears the ring once its owner has nothing unseen", () => {
    const tray: StoryGroup[] = [{ userId: "2", stories: [story("c")], hasUnseen: true }];

    const after = markStorySeen(tray, "c");

    expect(after[0].stories[0].viewedByMe).toBe(true);
    expect(after[0].hasUnseen).toBe(false);
    expect(tray[0].stories[0].viewedByMe).toBe(false);
  });

  it("keeps the ring while the owner still has an unseen story", () => {
    expect(markStorySeen(groups, "a")[0].hasUnseen).toBe(true);
  });
});
