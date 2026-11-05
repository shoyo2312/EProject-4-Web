import { describe, expect, it } from "vitest";

import type { MessageResponse } from "@/lib/api/conversations";
import {
  BOTTOM_PX,
  STICK_PX,
  addUnseen,
  appendedAfter,
  distanceFromBottom,
  isAtBottom,
  jumpButtonKind,
} from "../chat-scroll";

const msg = (id: string, senderId: string): MessageResponse => ({
  id,
  conversationId: "c1",
  senderId,
  type: "TEXT",
  content: id,
  stickerId: null,
  sticker: null,
  sentAt: "2026-10-27T08:00:00.000Z",
  replyToMessageId: null,
  replyTo: null,
  recalledAt: null,
  reactions: [],
  revision: 0,
});

describe("isAtBottom", () => {
  it("measures the distance below the visible area", () => {
    expect(distanceFromBottom({ scrollHeight: 1000, scrollTop: 400, clientHeight: 500 })).toBe(100);
  });

  it("is at the bottom within the strict tolerance, and not at the loose one", () => {
    const near = { scrollHeight: 1000, scrollTop: 1000 - 500 - BOTTOM_PX, clientHeight: 500 };
    const farther = { scrollHeight: 1000, scrollTop: 1000 - 500 - (BOTTOM_PX + 1), clientHeight: 500 };
    expect(isAtBottom(near)).toBe(true);
    expect(isAtBottom(farther)).toBe(false);
    expect(isAtBottom(farther, STICK_PX)).toBe(true);
  });

  it("counts a list that fits without scrolling as at the bottom", () => {
    expect(isAtBottom({ scrollHeight: 300, scrollTop: 0, clientHeight: 500 })).toBe(true);
  });
});

describe("jumpButtonKind", () => {
  it("hides at the bottom, shows an arrow above, and an avatar once something arrived above", () => {
    expect(jumpButtonKind(true, 0)).toBe("none");
    expect(jumpButtonKind(true, 3)).toBe("none");
    expect(jumpButtonKind(false, 0)).toBe("arrow");
    expect(jumpButtonKind(false, 1)).toBe("avatar");
  });
});

describe("appendedAfter", () => {
  const list = [msg("1", "2"), msg("2", "2"), msg("3", "1")];

  it("returns only what came after the previous newest message", () => {
    expect(appendedAfter(list, "2").map((m) => m.id)).toEqual(["3"]);
  });

  it("returns nothing when the list is unchanged at the end", () => {
    expect(appendedAfter(list, "3")).toEqual([]);
  });

  it("does not mistake older history prepended above for something new", () => {
    expect(appendedAfter([msg("0", "2"), ...list], "3")).toEqual([]);
  });

  it("returns nothing when the previous newest message is gone (a replaced thread)", () => {
    expect(appendedAfter(list, "999")).toEqual([]);
  });
});

describe("addUnseen", () => {
  it("adds the other side's messages once each and ignores the reader's own", () => {
    let unseen = addUnseen([], [msg("5", "2"), msg("6", "1")], "1");
    expect(unseen).toEqual(["5"]);
    unseen = addUnseen(unseen, [msg("5", "2"), msg("7", "2")], "1");
    expect(unseen).toEqual(["5", "7"]);
  });

  it("returns the same array when nothing is added, so state does not change", () => {
    const unseen = ["5"];
    expect(addUnseen(unseen, [msg("5", "2"), msg("6", "1")], "1")).toBe(unseen);
  });
});
