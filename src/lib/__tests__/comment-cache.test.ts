import { afterEach, describe, expect, it, vi } from "vitest";

import type { CommentPageResponse } from "@/lib/api/types";

const listComments = vi.fn();

vi.mock("@/lib/api/interactions", () => ({
  COMMENT_FIRST_PAGE_SIZE: 10,
  listComments: (videoId: string, cursor?: string, size?: number) =>
    listComments(videoId, cursor, size),
}));
vi.mock("@/lib/api/authors", () => ({
  resolveAuthor: (userId: string) => Promise.resolve({ userId, nickname: userId }),
  resolveAuthors: () => Promise.resolve(new Map()),
}));

const page = (ids: string[]): CommentPageResponse => ({
  items: ids.map((commentId) => ({
    commentId,
    videoId: "7",
    userId: "1",
    content: "hi",
    createdAt: new Date().toISOString(),
    parentId: null,
    replyToUserId: null,
    replyCount: 0,
    likeCount: 0,
    likedByMe: false,
  })),
  nextCursor: "next",
  hasMore: true,
});

/** Fresh module per test: the page cache is module state. */
async function load() {
  vi.resetModules();
  return import("@/lib/comment-cache");
}

afterEach(() => listComments.mockReset());

describe("loadFirstCommentPage", () => {
  it("fetches once per video and asks for the small first page", async () => {
    listComments.mockResolvedValue(page(["a"]));
    const { loadFirstCommentPage } = await load();

    await loadFirstCommentPage("7");
    await loadFirstCommentPage("7");

    expect(listComments).toHaveBeenCalledTimes(1);
    expect(listComments).toHaveBeenCalledWith("7", undefined, 10);
  });

  it("peeks only once the fetch has settled", async () => {
    listComments.mockResolvedValue(page(["a"]));
    const { loadFirstCommentPage, peekCommentPage } = await load();

    const pending = loadFirstCommentPage("7");
    expect(peekCommentPage("7")).toBeUndefined();
    await pending;
    expect(peekCommentPage("7")?.entries).toHaveLength(1);
    expect(peekCommentPage("7")?.cursor).toBe("next");
  });

  it("refetches after the thread changes, and after a failure", async () => {
    listComments.mockResolvedValue(page(["a"]));
    const { loadFirstCommentPage, invalidateCommentPage, peekCommentPage } =
      await load();

    await loadFirstCommentPage("7");
    invalidateCommentPage("7");
    expect(peekCommentPage("7")).toBeUndefined();
    await loadFirstCommentPage("7");
    expect(listComments).toHaveBeenCalledTimes(2);

    listComments.mockRejectedValueOnce(new Error("500"));
    invalidateCommentPage("7");
    await expect(loadFirstCommentPage("7")).rejects.toThrow("500");
    // The failed entry is gone, so the next open tries again.
    await loadFirstCommentPage("7");
    expect(listComments).toHaveBeenCalledTimes(4);
  });

  it("drops every video's rows when the session changes", async () => {
    listComments.mockResolvedValue(page(["a"]));
    const { loadFirstCommentPage, clearCommentCache, peekCommentPage } = await load();

    await loadFirstCommentPage("7");
    await loadFirstCommentPage("8");
    clearCommentCache();

    expect(peekCommentPage("7")).toBeUndefined();
    expect(peekCommentPage("8")).toBeUndefined();
  });
});
