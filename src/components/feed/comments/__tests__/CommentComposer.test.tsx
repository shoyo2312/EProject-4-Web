import { createRef } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { CommentComposer } from "@/components/feed/comments/CommentComposer";
import type { PostFailure } from "@/components/feed/comments/types";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({
    user: { userId: "1", username: "ann", nickname: "Ann", avatarUrl: "" },
    openLogin: () => {},
  }),
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/** Types "hi", presses Enter, and lets the post's answer land. */
async function post(onPost: (text: string) => Promise<PostFailure | null>) {
  render(
    <CommentComposer
      ref={createRef<HTMLInputElement>()}
      replyTo={null}
      onCancelReply={() => {}}
      onPost={onPost}
    />,
  );
  const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Add comment" });
  fireEvent.change(input, { target: { value: "hi" } });
  await act(async () => {
    fireEvent.keyDown(input, { key: "Enter" });
  });
  return { input, send: screen.getByRole<HTMLButtonElement>("button", { name: "Post comment" }) };
}

describe("CommentComposer", () => {
  it("empties the box once the post goes through", async () => {
    const { input } = await post(async () => null);
    expect(input.value).toBe("");
  });

  it("puts a refused post back in the box", async () => {
    const { input, send } = await post(async () => ({ retryAfter: null, refused: false }));
    expect(input.value).toBe("hi");
    expect(send.disabled).toBe(false);
  });

  it("keeps Post off for as long as the rate limit says", async () => {
    vi.useFakeTimers();
    const { send } = await post(async () => ({ retryAfter: 3, refused: false }));
    expect(send.disabled).toBe(true);

    act(() => vi.advanceTimersByTime(2_999));
    expect(send.disabled).toBe(true);
    act(() => vi.advanceTimersByTime(1));
    expect(send.disabled).toBe(false);
  });

  it("keeps a text the rules refused off Post until it is edited, and says why", async () => {
    const { input, send } = await post(async () => ({ retryAfter: null, refused: true }));
    expect(input.value).toBe("hi");
    expect(send.disabled).toBe(true);
    expect(screen.getByText(/Repeated violations/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "hi there" } });
    expect(send.disabled).toBe(false);
    expect(screen.queryByText(/Repeated violations/)).toBeNull();

    fireEvent.change(input, { target: { value: "hi " } });
    expect(send.disabled).toBe(true);
  });

  it("takes as many emoji as the server does, and not one more", async () => {
    const { input } = await post(async () => null);
    const hint = screen.getByText(/tối đa 150/);

    fireEvent.change(input, { target: { value: "🔥".repeat(150) } });
    expect(input.value).toBe("🔥".repeat(150));
    expect(hint.getAttribute("aria-hidden")).toBe("true");

    fireEvent.change(input, { target: { value: "🔥".repeat(151) } });
    expect(input.value).toBe("🔥".repeat(150));
    expect(hint.getAttribute("aria-hidden")).toBe("false");
  });
});

describe("CommentComposer emoji tray (the grid the chat shares)", () => {
  function mount() {
    render(
      <CommentComposer
        ref={createRef<HTMLInputElement>()}
        replyTo={null}
        onCancelReply={() => {}}
        onPost={async () => null}
      />,
    );
    const input = screen.getByRole<HTMLInputElement>("textbox", { name: "Add comment" });
    return { input, open: () => fireEvent.click(screen.getByRole("button", { name: "Emoji" })) };
  }

  it("opens a tray with the same groups the chat uses", () => {
    const { open } = mount();
    open();
    expect(screen.getByText("Smileys")).toBeTruthy();
    expect(screen.getByRole("button", { name: "😀" })).toBeTruthy();
    expect(screen.getByText("Hearts")).toBeTruthy();
  });

  it("inserts an emoji at the caret and does not post", async () => {
    const { input, open } = mount();
    fireEvent.change(input, { target: { value: "ab" } });
    input.setSelectionRange(1, 1);
    open();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "😀" }));
    });

    expect(input.value).toBe("a😀b");
  });

  it("replaces the selected text", async () => {
    const { input, open } = mount();
    fireEvent.change(input, { target: { value: "say HELLO now" } });
    input.setSelectionRange(4, 9);
    open();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "🎉" }));
    });

    expect(input.value).toBe("say 🎉 now");
  });

  it("closes on a press outside the bar and on Escape", () => {
    const { open } = mount();
    open();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByText("Smileys")).toBeNull();
  });
});

