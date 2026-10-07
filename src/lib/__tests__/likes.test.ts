import { describe, expect, it } from "vitest";

import {
  EMPTY_LEDGER,
  confirmLike,
  displayLikeCount,
  seedLikes,
  withLikeCount,
} from "@/lib/likes";

const status = (videoId: string, liked: boolean, likeCount: number) => ({
  videoId,
  liked,
  likeCount,
});

describe("seedLikes", () => {
  it("records every status in the batch", () => {
    const ledger = seedLikes(EMPTY_LEDGER, [status("1", true, 5), status("2", false, 0)]);
    expect(ledger.liked).toEqual({ "1": true, "2": false });
    expect(ledger.counts).toEqual({ "1": 5, "2": 0 });
  });

  it("never overwrites what a reply or a frame already said", () => {
    const heard = withLikeCount(confirmLike(EMPTY_LEDGER, status("1", false, 3)), "2", 9);
    const ledger = seedLikes(heard, [status("1", true, 4), status("2", true, 8)]);

    expect(ledger.liked).toEqual({ "1": false, "2": true });
    expect(ledger.counts).toEqual({ "1": 3, "2": 9 });
  });

  it("leaves its input alone", () => {
    seedLikes(EMPTY_LEDGER, [status("1", true, 1)]);
    expect(EMPTY_LEDGER).toEqual({ liked: {}, counts: {} });
  });
});

describe("confirmLike", () => {
  it("overwrites both the heart and the count", () => {
    const seeded = seedLikes(EMPTY_LEDGER, [status("1", true, 5)]);
    const ledger = confirmLike(seeded, status("1", false, 4));
    expect(ledger.liked["1"]).toBe(false);
    expect(ledger.counts["1"]).toBe(4);
  });
});

describe("withLikeCount", () => {
  it("replaces the count and keeps the heart", () => {
    const seeded = seedLikes(EMPTY_LEDGER, [status("1", true, 5)]);
    const ledger = withLikeCount(seeded, "1", 7);
    expect(ledger.counts["1"]).toBe(7);
    expect(ledger.liked["1"]).toBe(true);
  });

  it("returns the same ledger when the count did not move", () => {
    const seeded = seedLikes(EMPTY_LEDGER, [status("1", true, 5)]);
    expect(withLikeCount(seeded, "1", 5)).toBe(seeded);
  });
});

describe("displayLikeCount", () => {
  it("shows the server's count when the heart agrees with it", () => {
    expect(displayLikeCount(5, true, true)).toBe(5);
    expect(displayLikeCount(5, false, false)).toBe(5);
  });

  it("adds or removes the viewer's unconfirmed tap", () => {
    expect(displayLikeCount(5, true, false)).toBe(6);
    expect(displayLikeCount(5, false, true)).toBe(4);
  });
});
