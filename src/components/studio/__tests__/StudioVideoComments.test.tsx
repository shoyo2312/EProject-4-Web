import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StudioVideoComments } from "@/components/studio/StudioVideoComments";
import { addComment } from "@/lib/api/interactions";

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
vi.mock("@/lib/api/videos", () => ({
  getVideo: () =>
    Promise.resolve({
      id: "1001",
      userId: "9",
      title: "video_31",
      createdAt: "2026-11-04T09:00:00Z",
      viewCount: 82,
      likeCount: 1,
      commentCount: 6,
    }),
}));

const listReplies = vi.fn();
vi.mock("@/lib/api/interactions", () => ({
  addComment: vi.fn(),
  approveComment: vi.fn(),
  deleteComment: vi.fn(),
  likeComment: vi.fn(),
  unlikeComment: vi.fn(),
  getVideoCounts: () => Promise.resolve([]),
  listReplies: (...args: unknown[]) => listReplies(...args),
}));

const listInboxComments = vi.fn();
vi.mock("@/lib/api/studio", () => ({
  listInboxComments: (...args: unknown[]) => listInboxComments(...args),
  listStudioPosts: () => Promise.resolve({ content: [], page: { size: 50, number: 0, totalElements: 0, totalPages: 0 } }),
}));

const comment = (id: string, extra: Record<string, unknown> = {}) => ({
  commentId: id,
  videoId: "1001",
  userId: "2",
  content: `c${id}`,
  createdAt: "2026-11-04T10:00:00Z",
  parentId: null,
  replyToUserId: null,
  likeCount: 0,
  likedByMe: false,
  replyCount: 0,
  ...extra,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioVideoComments", () => {
  it("asks the inbox for this video only, lists top-level comments, and opens a thread on demand", async () => {
    listInboxComments.mockResolvedValue({
      items: [comment("1", { replyCount: 1 }), comment("2", { parentId: "1" })],
      nextCursor: null,
      hasMore: false,
    });
    listReplies.mockResolvedValue({
      items: [comment("2", { parentId: "1", userId: "9", content: "hay" })],
      nextCursor: null,
      hasMore: false,
    });

    render(<StudioVideoComments videoId="1001" />);

    await waitFor(() => expect(listInboxComments.mock.calls[0]?.[0]).toMatchObject({ videoId: "1001" }));
    await screen.findByText("c1");
    expect(screen.queryByText("c2")).toBeNull();

    fireEvent.click(screen.getByText("View 1 reply"));
    await screen.findByText("hay");
    expect(listReplies).toHaveBeenCalledWith("1001", "1", undefined, 20);
    expect(screen.getByText("Creator")).toBeTruthy();
  });

  it("sends the sort and the answered filter to the inbox, and lists reply hits while searching", async () => {
    listInboxComments.mockResolvedValue({
      items: [comment("1"), comment("2", { parentId: "1", content: "reply hit" })],
      nextCursor: null,
      hasMore: false,
    });
    render(<StudioVideoComments videoId="1001" />);
    await screen.findByText("c1");
    expect(screen.queryByText("reply hit")).toBeNull();

    fireEvent.click(screen.getByText("Sort by newest comments"));
    fireEvent.click(screen.getByText("Sort by most liked"));
    await waitFor(() => expect(listInboxComments.mock.calls.at(-1)?.[0]).toMatchObject({ sort: "MOST_LIKED" }));

    fireEvent.click(screen.getByText("All comments"));
    fireEvent.click(screen.getByText("Unanswered"));
    await waitFor(() => expect(listInboxComments.mock.calls.at(-1)?.[0]).toMatchObject({ replied: false }));

    fireEvent.change(screen.getByPlaceholderText("Search comments or usernames"), { target: { value: "hit" } });
    await waitFor(() => expect(listInboxComments.mock.calls.at(-1)?.[0]).toMatchObject({ q: "hit" }));
    await screen.findByText("reply hit");
  });
});

describe("Reply to comments box", () => {
  it("posts once however often Enter is pressed while the post is on its way", async () => {
    listInboxComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    vi.mocked(addComment).mockReturnValue(new Promise(() => {}));
    render(<StudioVideoComments videoId="1001" />);

    const box = screen.getByPlaceholderText("Reply to comments");
    fireEvent.change(box, { target: { value: "hello" } });
    fireEvent.submit(box.closest("form")!);
    fireEvent.submit(box.closest("form")!);

    expect(addComment).toHaveBeenCalledTimes(1);
  });

  it("counts an emoji as one of the 150, as the server does", () => {
    listInboxComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    render(<StudioVideoComments videoId="1001" />);

    const box = screen.getByPlaceholderText("Reply to comments");
    fireEvent.change(box, { target: { value: "😀😀" } });

    expect(screen.getByText("2/150")).toBeTruthy();
  });
  it("takes focus into the post drawer and hands it back to its button on close", async () => {
    listInboxComments.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
    render(<StudioVideoComments videoId="1001" />);

    const opener = screen.getByRole("button", { name: "Choose another post" });
    opener.focus();
    fireEvent.click(opener);
    const drawer = screen.getByRole("dialog", { name: "Choose another post" });
    expect(drawer.getAttribute("aria-modal")).toBe("true");
    await waitFor(() => expect(drawer.contains(document.activeElement)).toBe(true));

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
