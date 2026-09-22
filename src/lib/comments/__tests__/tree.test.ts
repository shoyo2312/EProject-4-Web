import { describe, expect, it } from "vitest";

import {
  addReply,
  hasCommentId,
  mergeComments,
  remapCommentId,
  removeCommentById,
  setCommentLikes,
  type PendingReply,
} from "@/lib/comments/tree";
import type { Comment } from "@/types/tiktok";

const author = { username: "a", nickname: "A", avatarUrl: "" };
const comment = (id: string, replies?: Comment[]): Comment => ({
  id,
  author,
  text: id,
  timestamp: "now",
  likes: 0,
  replies,
  replyCount: replies?.length,
});

describe("setCommentLikes", () => {
  it("updates a top-level comment or a nested reply", () => {
    const list = [comment("1", [comment("1a")]), comment("2")];
    expect(setCommentLikes(list, "2", 5)[1].likes).toBe(5);
    expect(setCommentLikes(list, "1a", 3)[0].replies?.[0].likes).toBe(3);
  });
});

describe("removeCommentById", () => {
  it("drops a reply and decrements its parent's tally", () => {
    const list = [comment("1", [comment("1a"), comment("1b")])];
    const next = removeCommentById(list, "1a");
    expect(next[0].replies?.map((r) => r.id)).toEqual(["1b"]);
    expect(next[0].replyCount).toBe(1);
  });

  it("drops a top-level comment", () => {
    expect(removeCommentById([comment("1"), comment("2")], "1")).toHaveLength(1);
  });
});

describe("addReply / hasCommentId / remapCommentId", () => {
  it("appends under the parent and bumps replyCount", () => {
    const next = addReply([comment("1")], "1", comment("1a"));
    expect(next[0].replies?.[0].id).toBe("1a");
    expect(next[0].replyCount).toBe(1);
  });

  it("finds ids at either level", () => {
    const list = [comment("1", [comment("1a")])];
    expect(hasCommentId(list, "1a")).toBe(true);
    expect(hasCommentId(list, "x")).toBe(false);
  });

  it("swaps an optimistic id for the saved one", () => {
    const list = [comment("1", [comment("pending-1")])];
    expect(remapCommentId(list, "pending-1", "9")[0].replies?.[0].id).toBe("9");
  });
});

describe("mergeComments", () => {
  it("dedupes by id and attaches pending replies once their parent lands", () => {
    const pending: PendingReply[] = [{ ui: comment("2a"), parentId: "2" }];
    const next = mergeComments(
      [comment("1")],
      [
        { ui: comment("1"), parentId: null },
        { ui: comment("2"), parentId: null },
      ],
      pending,
    );
    expect(next.map((c) => c.id)).toEqual(["1", "2"]);
    expect(next[1].replies?.[0].id).toBe("2a");
    // The parked reply is consumed, not left to attach twice.
    expect(pending).toHaveLength(0);
  });
});
