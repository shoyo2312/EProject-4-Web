import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ReplyThread } from "@/components/feed/comments/ReplyThread";
import type { Comment } from "@/types/tiktok";

// The server has nothing past the replies already in hand.
vi.mock("@/lib/api/interactions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/interactions")>()),
  listReplies: async () => ({ items: [], nextCursor: null, hasMore: false }),
}));

const reply = (id: string): Comment => ({
  id,
  author: { userId: id, username: id, nickname: id, avatarUrl: "" },
  text: `reply ${id}`,
  timestamp: "now",
  likes: 0,
});

const replies = ["r1", "r2", "r3", "r4"].map(reply);

afterEach(cleanup);

const renderThread = (props: { replies: Comment[]; justAddedId?: string }) =>
  render(
    <ReplyThread
      replies={props.replies}
      replyCount={props.replies.length}
      parentId="parent"
      videoId="365050354607333376"
      justAddedId={props.justAddedId}
      renderReply={(item) => <p>{item.text}</p>}
    />,
  );

describe("ReplyThread", () => {
  it("reveals replies a page at a time through renderReply, and hides them", () => {
    const { container } = renderThread({ replies });
    expect(container.querySelectorAll("p")).toHaveLength(0);

    fireEvent.click(screen.getByRole("button", { name: /View 4 replies/ }));
    expect(screen.getByText("reply r3")).toBeTruthy();
    expect(screen.queryByText("reply r4")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: /View 1 reply/ }));
    expect(screen.getByText("reply r4")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /Hide/ }));
    expect(container.querySelectorAll("p")).toHaveLength(0);
  });

  it("opens itself when the viewer's own reply lands in a collapsed thread", () => {
    const { rerender } = renderThread({ replies: replies.slice(0, 2) });
    expect(screen.queryByText("reply r2")).toBeNull();

    rerender(
      <ReplyThread
        replies={replies.slice(0, 3)}
        replyCount={3}
        parentId="parent"
        videoId="365050354607333376"
        justAddedId="r3"
        renderReply={(item) => <p>{item.text}</p>}
      />,
    );

    expect(screen.getByText("reply r3")).toBeTruthy();
    expect(screen.getByText("reply r1")).toBeTruthy();
  });
});
