import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommentItem } from "@/components/feed/comments/CommentItem";
import type { Comment } from "@/types/tiktok";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/image", () => ({ default: (props: { alt: string }) => <span aria-label={props.alt} /> }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" }, openLogin: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const comment = (authorId: string, extra: Partial<Comment> = {}): Comment => ({
  id: "c1",
  author: { userId: authorId, username: `u${authorId}`, nickname: `User ${authorId}`, avatarUrl: "" } as Comment["author"],
  text: "hello",
  timestamp: "1m",
  likes: 0,
  ...extra,
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

const dialog = () => screen.queryByRole("dialog");

describe("CommentItem", () => {
  it("marks the video owner's comment Creator, the way TikTok does", () => {
    render(<CommentItem comment={comment("1")} videoId="v" creatorId="1" />);

    expect(screen.getByText("Creator")).toBeTruthy();
  });

  it("puts the Creator pill on the author, before whom the reply answers", () => {
    render(<CommentItem comment={comment("1", { replyToName: "Robot Club" })} videoId="v" creatorId="1" />);

    const pill = screen.getByText("Creator");
    const target = screen.getByText("Robot Club");
    expect(pill.compareDocumentPosition(target) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("links each @mention to that account's profile, leaving an address as text", () => {
    render(<CommentItem comment={comment("2", { text: "hi @Bob.B and me@x.com" })} videoId="v" />);

    expect(screen.getByRole("link", { name: "@Bob.B" }).getAttribute("href")).toBe("/@Bob.B");
    expect(screen.queryByRole("link", { name: /x\.com/ })).toBeNull();
  });

  it("does not mark anyone else", () => {
    render(<CommentItem comment={comment("2")} videoId="v" creatorId="1" />);

    expect(screen.queryByText("Creator")).toBeNull();
  });

  it("asks before the owner deletes someone else's comment", () => {
    const onDelete = vi.fn();
    render(<CommentItem comment={comment("2")} videoId="v" currentUserId="1" canModerate onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText("Delete this comment?")).toBeTruthy();

    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));
    // The sheet shrinks away first; the row only leaves once it has.
    expect(onDelete).not.toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(300));
    expect(onDelete).toHaveBeenCalledWith("c1");
  });

  it("deletes nothing when the confirm is cancelled", () => {
    const onDelete = vi.fn();
    render(<CommentItem comment={comment("2")} videoId="v" currentUserId="1" canModerate onDelete={onDelete} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    vi.useFakeTimers();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    // Still on screen for the exit motion, but no longer answering.
    expect(dialog()).not.toBeNull();
    expect(dialog()!.closest("[inert]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(dialog()).toBeNull();
    expect(onDelete).not.toHaveBeenCalled();
  });

  it("opens with TikTok's modal motion", () => {
    render(<CommentItem comment={comment("2")} videoId="v" currentUserId="1" canModerate onDelete={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "More options" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));

    // The mask fades in and the card grows from a tenth of its size, as the logout confirm does.
    expect(dialog()?.className).toContain("starting:scale-10");
    expect(dialog()?.parentElement?.className).toContain("starting:opacity-0");
  });
});
