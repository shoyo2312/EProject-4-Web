import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { Thread } from "@/components/studio/StudioVideoComments";
import type { CommentResponse } from "@/lib/api/types";
import type { Author } from "@/types/tiktok";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const author = (id: string) => ({ userId: id, username: `u${id}`, nickname: `User ${id}`, avatarUrl: "" }) as Author;
const authors = new Map(["1", "2", "3"].map((id) => [id, author(id)]));
vi.mock("@/hooks/use-comment-context", () => ({ useCommentContext: () => ({ authors, videos: new Map() }) }));

const addComment = vi.fn();
const deleteComment = vi.fn();
const listReplies = vi.fn();
vi.mock("@/lib/api/interactions", () => ({
  addComment: (...args: unknown[]) => addComment(...args),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
  listReplies: (...args: unknown[]) => listReplies(...args),
  approveComment: vi.fn(),
  getVideoCounts: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
}));

const comment = (id: string, userId: string, extra: Partial<CommentResponse> = {}): CommentResponse => ({
  commentId: id,
  videoId: "v",
  userId,
  content: `text ${id}`,
  createdAt: "2026-11-05T00:00:00Z",
  parentId: null,
  replyToUserId: null,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  status: "VISIBLE",
  ...extra,
});

const mount = (root: CommentResponse) => {
  const onDeleted = vi.fn();
  render(<Thread comment={root} ownerId="1" authors={authors} onChanged={vi.fn()} onDeleted={onDeleted} />);
  return { onDeleted };
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("Studio comment thread", () => {
  it("asks before deleting someone's comment, and deletes only on confirm", async () => {
    deleteComment.mockResolvedValueOnce(undefined);
    const { onDeleted } = mount(comment("c1", "2"));

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(deleteComment).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this comment?")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("c1"));
    expect(deleteComment).toHaveBeenCalledWith("v", "c1");
  });

  it("animates the confirm in and out instead of popping it", async () => {
    mount(comment("c1", "2"));

    fireEvent.click(screen.getByRole("button", { name: /Delete/ }));
    expect(screen.getByRole("dialog").className).toContain("starting:scale-10");

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    // Shrinking away, inert, then gone.
    expect(screen.getByRole("dialog").className).toContain("scale-10");
    expect(screen.getByRole("dialog").closest("[inert]")).not.toBeNull();
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("shows the owner's replies with the Creator label, and whom each one answers", async () => {
    listReplies.mockResolvedValueOnce({
      items: [comment("r1", "3", { parentId: "c1" }), comment("r2", "1", { parentId: "c1", replyToUserId: "3" })],
      nextCursor: null,
      hasMore: false,
    });
    mount(comment("c1", "2", { replyCount: 2 }));

    fireEvent.click(screen.getByRole("button", { name: /View 2 replies/ }));

    expect(await screen.findByText("text r2")).toBeTruthy();
    expect(screen.getByText("Creator")).toBeTruthy();
    // r2 answers r1's author: "User 1 ▸ User 3".
    expect(screen.getByLabelText("Replying to User 3")).toBeTruthy();
  });

  it("replies to a reply with that reply's id, so the backend records whom it answers", async () => {
    listReplies.mockResolvedValueOnce({ items: [comment("r1", "3", { parentId: "c1" })], nextCursor: null, hasMore: false });
    addComment.mockResolvedValueOnce(comment("r9", "1", { parentId: "c1", replyToUserId: "3", content: "thanks" }));
    mount(comment("c1", "2", { replyCount: 1 }));

    fireEvent.click(screen.getByRole("button", { name: /View 1 reply/ }));
    await screen.findByText("text r1");
    fireEvent.click(screen.getAllByRole("button", { name: /Reply/ })[1]);
    const box = screen.getByPlaceholderText("Reply to User 3");
    fireEvent.change(box, { target: { value: "thanks" } });
    fireEvent.submit(box.closest("form")!);

    await waitFor(() => expect(addComment).toHaveBeenCalledWith("v", "thanks", "r1"));
    expect(await screen.findByText("thanks")).toBeTruthy();
  });
});
