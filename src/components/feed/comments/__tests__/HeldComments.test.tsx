import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { HeldComments } from "@/components/feed/comments/HeldComments";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import type { CommentResponse } from "@/lib/api/types";

const VIDEO = "365050354607333376";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/lib/api/authors", () => ({
  resolveAuthors: async () => new Map(),
  resolveAuthor: async (userId: string) => ({
    userId,
    username: "bob",
    nickname: "Bob",
    avatarUrl: "/bob.png",
  }),
}));

const listHeldComments = vi.fn();
const approveComment = vi.fn();
const deleteComment = vi.fn();
vi.mock("@/lib/api/interactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/interactions")>()),
  listHeldComments: (...args: unknown[]) => listHeldComments(...args),
  approveComment: (...args: unknown[]) => approveComment(...args),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
}));

const held = (commentId: string, content: string): CommentResponse => ({
  commentId,
  videoId: VIDEO,
  userId: "2",
  content,
  createdAt: "2026-10-14T00:00:00Z",
  parentId: null,
  replyToUserId: null,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  status: "HELD",
});

const page = (items: CommentResponse[], nextCursor: string | null = null) => ({
  items,
  nextCursor,
  hasMore: nextCursor !== null,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

/** Opens the queue of two held comments. */
async function openQueue(onApproved = vi.fn()) {
  listHeldComments.mockResolvedValue(page([held("11", "call me 0912"), held("12", "bit.ly/x")]));
  render(<HeldComments videoId={VIDEO} onApproved={onApproved} />);
  fireEvent.click(await screen.findByRole("button", { name: /2 comments held for review/ }));
  return onApproved;
}

describe("HeldComments", () => {
  it("shows nothing while nothing is held", async () => {
    listHeldComments.mockResolvedValue(page([]));
    const { container } = render(<HeldComments videoId={VIDEO} onApproved={vi.fn()} />);

    await act(() => new Promise((resolve) => setTimeout(resolve, 0)));

    expect(container.innerHTML).toBe("");
  });

  it("approving a comment publishes and counts it", async () => {
    approveComment.mockResolvedValue({ ...held("11", "call me 0912"), status: "VISIBLE" });
    const onApproved = await openQueue();

    fireEvent.click(screen.getAllByRole("button", { name: /^Approve/ })[0]);

    await waitFor(() => expect(screen.queryByText("call me 0912")).toBeNull());
    expect(approveComment).toHaveBeenCalledWith(VIDEO, "11");
    expect(onApproved).toHaveBeenCalledTimes(1);
    expect(screen.getByText("bit.ly/x")).toBeTruthy();
  });

  it("deleting a comment rejects it without counting it", async () => {
    deleteComment.mockResolvedValue(undefined);
    const onApproved = await openQueue();

    fireEvent.click(screen.getAllByRole("button", { name: /^Delete/ })[1]);

    await waitFor(() => expect(screen.queryByText("bit.ly/x")).toBeNull());
    expect(deleteComment).toHaveBeenCalledWith(VIDEO, "12");
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("drops a comment that is gone by the time it is approved", async () => {
    approveComment.mockRejectedValue(new ApiError(404, "COMMENT_NOT_FOUND", "gone"));
    const onApproved = await openQueue();

    fireEvent.click(screen.getAllByRole("button", { name: /^Approve/ })[0]);

    await waitFor(() => expect(screen.queryByText("call me 0912")).toBeNull());
    expect(onApproved).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledTimes(1);
  });

  it("keeps a comment whose approval failed", async () => {
    approveComment.mockRejectedValue(new ApiError(503, "INTERACTION_NOT_RECORDED", "kafka"));
    const onApproved = await openQueue();

    fireEvent.click(screen.getAllByRole("button", { name: /^Approve/ })[0]);

    await waitFor(() => expect(toast.error).toHaveBeenCalledTimes(1));
    expect(screen.getByText("call me 0912")).toBeTruthy();
    expect(onApproved).not.toHaveBeenCalled();
  });

  it("pages further into the queue from where the last page ended", async () => {
    listHeldComments
      .mockResolvedValueOnce(page([held("11", "call me 0912")], "c1"))
      .mockResolvedValueOnce(page([held("10", "fb88 vào đây")]));
    render(<HeldComments videoId={VIDEO} onApproved={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: /held for review/ }));

    fireEvent.click(screen.getByRole("button", { name: "Show more" }));

    expect(await screen.findByText("fb88 vào đây")).toBeTruthy();
    expect(listHeldComments).toHaveBeenLastCalledWith(VIDEO, "c1");
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });
});
