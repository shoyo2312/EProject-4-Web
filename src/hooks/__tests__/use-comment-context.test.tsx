import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, renderHook, waitFor } from "@testing-library/react";

import { useCommentContext } from "@/hooks/use-comment-context";
import type { CommentResponse } from "@/lib/api/types";

const resolveAuthors = vi.fn(async (ids: string[]) => new Map(ids.map((id) => [id, { userId: id, nickname: `User ${id}` }])));
vi.mock("@/lib/api/authors", () => ({ resolveAuthors: (ids: string[]) => resolveAuthors(ids) }));
vi.mock("@/lib/api/videos", () => ({ getVideosByIds: async () => [] }));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("useCommentContext", () => {
  it("names whom a reply answers as well as who wrote it", async () => {
    const reply = { commentId: "r", videoId: "v", userId: "1", replyToUserId: "3" } as CommentResponse;

    const { result } = renderHook(() => useCommentContext([reply]));

    await waitFor(() => expect(result.current.authors.get("3")?.nickname).toBe("User 3"));
    expect(resolveAuthors).toHaveBeenCalledWith(["1", "3"]);
  });
});
