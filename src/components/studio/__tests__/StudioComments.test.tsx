import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import StudioCommentsRoute from "@/app/studio/comment/page";
import { StudioComments } from "@/components/studio/StudioComments";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/hooks/use-comment-context", () => ({
  useCommentContext: () => ({ authors: new Map(), videos: new Map() }),
}));
const deleteComment = vi.fn();
vi.mock("@/lib/api/interactions", () => ({
  addComment: vi.fn(),
  approveComment: vi.fn(),
  deleteComment: (...args: unknown[]) => deleteComment(...args),
}));
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: { userId: "me" } }) }));

const listInboxComments = vi.fn();
vi.mock("@/lib/api/studio", () => ({
  listInboxComments: (...args: unknown[]) => listInboxComments(...args),
  listStudioPosts: () => Promise.resolve({ content: [], page: { size: 50, number: 0, totalElements: 0, totalPages: 0 } }),
}));

const videoIdOfCall = (index: number) => (listInboxComments.mock.calls[index]?.[0] as { videoId?: string }).videoId;

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("/studio/comment route", () => {
  it("remounts the inbox when the URL moves to another post, so the filter follows it", async () => {
    listInboxComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });

    const first = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "1001" }) });
    const { rerender } = render(first);
    await waitFor(() => expect(videoIdOfCall(0)).toBe("1001"));

    rerender(await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "1002" }) }));

    await waitFor(() => expect(videoIdOfCall(listInboxComments.mock.calls.length - 1)).toBe("1002"));
  });

  it("drops a videoId that cannot be a backend id before it reaches the inbox", async () => {
    const element = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "x7" }) });
    expect(element.props.initialVideoId).toBeUndefined();
  });

  it("passes a real video id through", async () => {
    const element = await StudioCommentsRoute({ searchParams: Promise.resolve({ videoId: "7312458901234567" }) });
    expect(element.props.initialVideoId).toBe("7312458901234567");
  });
});

describe("StudioComments — delete", () => {
  const comment = (commentId: string, userId: string) => ({
    commentId,
    videoId: "v1",
    userId,
    content: `Comment ${commentId}`,
    createdAt: "2026-11-01T00:00:00Z",
    parentId: null,
    replyToUserId: null,
    likeCount: 0,
    likedByMe: false,
    replyCount: 0,
  });

  it("asks before deleting someone else's comment, and Cancel deletes nothing", async () => {
    listInboxComments.mockResolvedValue({ items: [comment("c1", "someone")], nextCursor: null, hasMore: false });
    deleteComment.mockResolvedValue(undefined);
    render(<StudioComments />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this comment?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(deleteComment).not.toHaveBeenCalled();
    expect(screen.queryByText("Delete this comment?")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    const confirm = screen.getAllByRole("button", { name: "Delete" }).at(-1)!;
    fireEvent.click(confirm);
    await waitFor(() => expect(screen.queryByText("Comment c1")).toBeNull());
    expect(deleteComment).toHaveBeenCalledWith("v1", "c1");
  });

  it("deletes the creator's own comment without asking", async () => {
    listInboxComments.mockResolvedValue({ items: [comment("c2", "me")], nextCursor: null, hasMore: false });
    deleteComment.mockResolvedValue(undefined);
    render(<StudioComments />);

    fireEvent.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.queryByText("Delete this comment?")).toBeNull();
    await waitFor(() => expect(deleteComment).toHaveBeenCalledWith("v1", "c2"));
  });
});
