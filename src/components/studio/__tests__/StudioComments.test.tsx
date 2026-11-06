import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import StudioCommentsRoute from "@/app/studio/comment/page";
import { StudioComments } from "@/components/studio/StudioComments";
import { INBOX_POLL_MS } from "@/hooks/use-inbox-comments";

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
const addComment = vi.fn();
vi.mock("@/lib/api/interactions", () => ({
  addComment: (...args: unknown[]) => addComment(...args),
  approveComment: vi.fn(),
  deleteComment: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
  listReplies: vi.fn(),
  getVideoCounts: vi.fn(),
}));

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

describe("Studio comment inbox", () => {
  it("answers a reply with that reply's id, so the post shows whom the owner answered", async () => {
    const reply = {
      commentId: "r1",
      videoId: "1001",
      userId: "3",
      content: "a reply in the inbox",
      createdAt: "2026-11-05T00:00:00Z",
      parentId: "c1",
      replyToUserId: null,
      likeCount: 0,
      likedByMe: false,
      replyCount: 0,
      status: "VISIBLE",
    };
    listInboxComments.mockResolvedValue({ items: [reply], nextCursor: null, hasMore: false });
    addComment.mockResolvedValueOnce({ ...reply, commentId: "r2", userId: "1", replyToUserId: "3", content: "thanks" });
    render(<StudioComments />);

    await screen.findByText("a reply in the inbox");
    fireEvent.click(screen.getByRole("button", { name: /Reply/ }));
    const box = screen.getByPlaceholderText(/Reply to/);
    fireEvent.change(box, { target: { value: "thanks" } });
    fireEvent.submit(box.closest("form")!);

    // Not "c1", the thread's root: the backend derives "owner ▸ user" from the id it is given.
    await waitFor(() => expect(addComment).toHaveBeenCalledWith("1001", "thanks", "r1"));
    // And the owner's reply shows at once, under the row it answers.
    expect(await screen.findByText("thanks")).toBeTruthy();
  });

  const row = (commentId: string, content: string) => ({
    commentId,
    videoId: "1001",
    userId: "3",
    content,
    createdAt: "2026-11-05T00:00:00Z",
    parentId: null,
    replyToUserId: null,
    likeCount: 0,
    likedByMe: false,
    replyCount: 0,
    status: "VISIBLE",
  });

  it("drops a Load more page that answers the filter the owner already left", async () => {
    let finishStale: (page: unknown) => void = () => {};
    listInboxComments
      .mockResolvedValueOnce({ items: [row("c1", "first page")], nextCursor: "cur-1", hasMore: true })
      .mockReturnValueOnce(new Promise((resolve) => (finishStale = resolve)))
      .mockResolvedValueOnce({ items: [row("h1", "held comment")], nextCursor: null, hasMore: false });
    render(<StudioComments />);

    fireEvent.click(await screen.findByRole("button", { name: "Load more" }));
    fireEvent.click(screen.getByRole("button", { name: /All comments/ }));
    fireEvent.click(screen.getByRole("button", { name: "Held for review" }));
    await screen.findByText("held comment");

    finishStale({ items: [row("c2", "stale page")], nextCursor: null, hasMore: false });
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(screen.queryByText("stale page")).toBeNull();
    const staleSignal = listInboxComments.mock.calls[1][3] as AbortSignal;
    expect(staleSignal.aborted).toBe(true);
  });

  it("asks for the next page once, however fast Load more is clicked", async () => {
    listInboxComments
      .mockResolvedValueOnce({ items: [row("c1", "first page")], nextCursor: "cur-1", hasMore: true })
      .mockReturnValueOnce(new Promise(() => {}));
    render(<StudioComments />);

    const button = await screen.findByRole("button", { name: "Load more" });
    fireEvent.click(button);
    fireEvent.click(button);

    expect(listInboxComments).toHaveBeenCalledTimes(2);
  });
});

describe("Studio comment inbox — while open", () => {
  it("puts a comment that arrives meanwhile on top, held ones included, without a reload", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const comment = (commentId: string, content: string, status: string) => ({
        commentId,
        videoId: "1001",
        userId: "3",
        content,
        createdAt: "2026-11-05T00:00:00Z",
        parentId: null,
        replyToUserId: null,
        likeCount: 0,
        likedByMe: false,
        replyCount: 0,
        status,
      });
      listInboxComments
        .mockResolvedValueOnce({ items: [comment("c1", "older", "VISIBLE")], nextCursor: null, hasMore: false })
        .mockResolvedValue({
          items: [comment("c2", "just held", "HELD"), comment("c1", "older", "VISIBLE")],
          nextCursor: null,
          hasMore: false,
        });
      render(<StudioComments />);
      await screen.findByText("older");

      await act(() => vi.advanceTimersByTimeAsync(INBOX_POLL_MS));

      expect(await screen.findByText("just held")).toBeTruthy();
      expect(screen.getAllByText("older")).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
