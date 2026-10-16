import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { CommentPanel } from "@/components/feed/CommentPanel";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import type { CommentResponse } from "@/lib/api/types";
import { clearCommentCache } from "@/lib/comment-cache";

const VIDEO = "365050354607333376";

// jsdom has no layout, so no scrolling either; the panel scrolls to a new post.
Element.prototype.scrollTo = () => {};

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({
    user: { userId: "1", username: "ann", nickname: "Ann", avatarUrl: "/ann.png" },
    openLogin: () => {},
  }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-comment-realtime", () => ({ useCommentRealtime: () => {} }));
vi.mock("@/lib/api/authors", () => ({
  resolveAuthors: async () => new Map(),
  resolveAuthor: async (userId: string) => ({
    userId,
    username: "bob",
    nickname: "Bob",
    avatarUrl: "/bob.png",
  }),
}));

const listComments = vi.fn();
const addComment = vi.fn();
const listHeldComments = vi.fn();
const getCommentPermission = vi.fn();
vi.mock("@/lib/api/interactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/interactions")>()),
  listComments: (...args: unknown[]) => listComments(...args),
  addComment: (...args: unknown[]) => addComment(...args),
  listHeldComments: (...args: unknown[]) => listHeldComments(...args),
  getCommentPermission: (...args: unknown[]) => getCommentPermission(...args),
}));

beforeEach(() => {
  getCommentPermission.mockResolvedValue({ restriction: null, restrictedUntil: null });
});

const comment = (overrides: Partial<CommentResponse>): CommentResponse => ({
  commentId: "5",
  videoId: VIDEO,
  userId: "2",
  content: "first",
  createdAt: "2026-10-14T00:00:00Z",
  parentId: null,
  replyToUserId: null,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  status: "VISIBLE",
  ...overrides,
});

afterEach(() => {
  cleanup();
  clearCommentCache();
  vi.clearAllMocks();
});

/** The viewer is user 1; the video is user 3's unless `ownerId` says otherwise. */
function renderPanel(ownerId = "3") {
  const onCommentAdded = vi.fn();
  const onCommentDeleted = vi.fn();
  render(
    <CommentPanel
      videoId={VIDEO}
      videoOwnerId={ownerId}
      commentCount={1}
      onClose={() => {}}
      onCommentAdded={onCommentAdded}
      onCommentDeleted={onCommentDeleted}
    />,
  );
  return { onCommentAdded, onCommentDeleted };
}

async function post(text: string) {
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: /Add comment|Reply to/ });
  fireEvent.change(input, { target: { value: text } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
}

describe("CommentPanel", () => {
  it("takes a held comment back out of the thread and the count", async () => {
    listComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    addComment.mockResolvedValue(comment({ commentId: "9", userId: "1", content: "hi", status: "HELD" }));
    const { onCommentAdded, onCommentDeleted } = renderPanel();

    await post("hi");

    await waitFor(() => expect(onCommentDeleted).toHaveBeenCalledTimes(1));
    expect(onCommentAdded).toHaveBeenCalledTimes(1);
    expect(screen.queryByText("hi")).toBeNull();
    expect(toast.success).toHaveBeenCalledWith(expect.stringMatching(/approve/i));
  });

  it("puts a rate-limited reply back on its thread and holds Post for Retry-After", async () => {
    listComments.mockResolvedValue({ items: [comment({})], nextCursor: null, hasMore: false });
    addComment.mockRejectedValue(new ApiError(429, "COMMENT_RATE_LIMITED", "slow down", 3));
    renderPanel();

    fireEvent.click(await screen.findByRole("button", { name: "Reply" }));
    await post("hi");

    const input = await screen.findByDisplayValue("hi");
    expect(input.getAttribute("aria-label")).toBe("Reply to bob");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Post reply" }).disabled).toBe(true);
    expect(addComment).toHaveBeenCalledWith(VIDEO, "hi", "5");
  });

  it("shows the held queue to the video's owner only", async () => {
    listComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listHeldComments.mockResolvedValue({
      items: [comment({ commentId: "9", status: "HELD" })],
      nextCursor: null,
      hasMore: false,
    });

    renderPanel();
    await screen.findByText("Start the conversation");
    expect(listHeldComments).not.toHaveBeenCalled();
    cleanup();

    renderPanel("1");
    expect(await screen.findByRole("button", { name: /1 comment held for review/ })).toBeTruthy();
  });

  it("says until when a viewer restricted for repeated violations can comment again", async () => {
    getCommentPermission.mockResolvedValue({
      restriction: "COMMENTING_RESTRICTED",
      restrictedUntil: new Date(Date.now() + 3_600_000).toISOString(),
    });
    listComments.mockResolvedValue({ items: [comment({})], nextCursor: null, hasMore: false });
    renderPanel();

    expect(await screen.findByText(/^You can’t comment until/)).toBeTruthy();
    await screen.findByText("first");
    expect(screen.queryByRole("textbox", { name: "Add comment" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
  });

  it("asks about the video's owner too, since a restriction follows the account", async () => {
    listComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    listHeldComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    renderPanel("1");

    await waitFor(() => expect(getCommentPermission).toHaveBeenCalledWith(VIDEO));
  });

  it("closes the box when a post finds the viewer restricted", async () => {
    listComments.mockResolvedValue({ items: [comment({})], nextCursor: null, hasMore: false });
    addComment.mockRejectedValue(new ApiError(403, "COMMENTING_RESTRICTED", "restricted", 3600));
    renderPanel();

    await screen.findByText("first");
    await post("hi");

    expect(await screen.findByText(/^You can’t comment until/)).toBeTruthy();
    expect(screen.queryByRole("textbox", { name: "Add comment" })).toBeNull();
  });

  it("opens the box again the moment the restriction lifts", async () => {
    getCommentPermission.mockResolvedValue({
      restriction: "COMMENTING_RESTRICTED",
      restrictedUntil: new Date(Date.now() + 1000).toISOString(),
    });
    listComments.mockResolvedValue({ items: [comment({})], nextCursor: null, hasMore: false });
    renderPanel();

    await screen.findByText(/^You can’t comment until/);
    expect(
      await screen.findByRole("textbox", { name: "Add comment" }, { timeout: 3000 }),
    ).toBeTruthy();
  });

  it("lets a different comment go out straight after a duplicate", async () => {
    listComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    addComment.mockRejectedValue(new ApiError(429, "DUPLICATE_COMMENT", "posted already", 600));
    renderPanel();

    await post("hi");

    await screen.findByDisplayValue("hi");
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Post comment" }).disabled).toBe(false);
    expect(toast.error).toHaveBeenCalledTimes(1);
  });
});
