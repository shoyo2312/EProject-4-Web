import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageList } from "@/components/messages/thread/MessageList";
import { ReactionBadges } from "@/components/messages/thread/ReactionBadges";
import { TypingRow } from "@/components/messages/thread/TypingRow";
import type { MessageResponse, ReactionView } from "@/lib/api/conversations";

beforeEach(() => {
  vi.stubGlobal("matchMedia", () => ({ matches: true, addEventListener: () => {}, removeEventListener: () => {} }));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
      unobserve() {}
    },
  );
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const ME = "1";
const msg = (n: number, over: Partial<MessageResponse> = {}): MessageResponse => ({
  id: String(n),
  conversationId: "c1",
  senderId: "2",
  type: "TEXT",
  content: `message ${n}`,
  stickerId: null,
  sticker: null,
  sentAt: new Date(Date.UTC(2026, 9, 27, 8, n)).toISOString(),
  replyToMessageId: null,
  replyTo: null,
  recalledAt: null,
  reactions: [],
  revision: 0,
  ...over,
});

function mount(messages: MessageResponse[], liveIds?: ReadonlySet<string>) {
  const props = {
    me: ME,
    hasMore: false,
    loadingOlder: false,
    onLoadOlder: vi.fn(),
    peerName: "Alice",
    peerAvatar: undefined,
    onReact: vi.fn(),
    onReply: vi.fn(),
    onDelete: vi.fn(),
  };
  const view = render(<MessageList messages={messages} liveIds={liveIds} {...props} />);
  return {
    rerender: (next: MessageResponse[], live?: ReadonlySet<string>) =>
      view.rerender(<MessageList messages={next} liveIds={live} {...props} />),
  };
}

const row = (id: string) => document.querySelector<HTMLElement>(`[data-id="${id}"]`)!;
const animated = (id: string) => row(id).className.includes("animate-chat-in");

describe("new message motion", () => {
  it("does not animate the history a thread opens with", () => {
    mount([msg(1), msg(2), msg(3)]);
    expect([1, 2, 3].map((n) => animated(String(n)))).toEqual([false, false, false]);
  });

  it("animates a message that arrived live, once, on its own side's corner", () => {
    const { rerender } = mount([msg(1), msg(2)]);
    rerender([msg(1), msg(2), msg(3), msg(4, { senderId: ME })], new Set(["3", "4"]));
    expect(animated("3")).toBe(true);
    expect(row("3").className).toContain("origin-bottom-left");
    expect(animated("4")).toBe(true);
    expect(row("4").className).toContain("origin-bottom-right");
    expect(animated("1")).toBe(false);
  });

  it("does not animate messages that only a refetch brought in", () => {
    const { rerender } = mount([msg(1), msg(2)]);
    rerender([msg(1), msg(2), msg(3)], new Set());
    expect(animated("3")).toBe(false);
  });

  it("does not replay when a receipt, a reaction or a plain re-render follows", () => {
    const { rerender } = mount([msg(1), msg(2)]);
    const live = new Set(["3"]);
    rerender([msg(1), msg(2), msg(3)], live);
    const before = row("3");
    rerender([msg(1), msg(2), msg(3, { reactions: [{ userId: "2", emoji: "👍" }], revision: 1 })], live);
    rerender([msg(1), msg(2), msg(3, { reactions: [{ userId: "2", emoji: "👍" }], revision: 1 })], live);
    expect(row("3")).toBe(before);
    expect(animated("1")).toBe(false);
    expect(animated("2")).toBe(false);
  });

  it("does not animate older pages prepended above", () => {
    const { rerender } = mount([msg(5), msg(6)]);
    rerender([msg(3), msg(4), msg(5), msg(6)], new Set(["3", "4"]));
    expect(animated("3")).toBe(false);
    expect(animated("4")).toBe(false);
  });

  it("slides a new reply's quote in, and shows a historical one at once", () => {
    const quote = { messageId: "1", state: "OK" as const, senderId: "2", type: "TEXT" as const, content: "hi", sticker: null };
    const { rerender } = mount([msg(1), msg(2, { replyToMessageId: "1", replyTo: quote })]);
    expect(document.querySelector(".animate-chat-quote-in, [class*='animate-chat-quote-in']")).toBeNull();
    rerender(
      [msg(1), msg(2, { replyToMessageId: "1", replyTo: quote }), msg(3, { replyToMessageId: "1", replyTo: quote })],
      new Set(["3"]),
    );
    expect(document.querySelectorAll("[class*='animate-chat-quote-in']")).toHaveLength(1);
    expect(row("3").querySelector("[class*='animate-chat-quote-in']")).not.toBeNull();
  });
});

describe("reaction motion", () => {
  const r = (userId: string, emoji: string): ReactionView => ({ userId, emoji });
  const motions = () => Object.fromEntries(screen.getAllByRole("button").map((b) => [b.textContent?.replace(/\d+$/, ""), b.dataset.motion ?? ""]));

  it("starts still, then pops only the new emoji and bumps only the one whose count rose", () => {
    const { rerender } = render(<ReactionBadges reactions={[r("2", "👍")]} me={ME} mine={false} onToggle={() => {}} />);
    expect(motions()).toEqual({ "👍": "" });

    rerender(<ReactionBadges reactions={[r("2", "👍"), r("3", "😂")]} me={ME} mine={false} onToggle={() => {}} />);
    expect(motions()).toEqual({ "👍": "", "😂": "pop" });

    rerender(<ReactionBadges reactions={[r("2", "👍"), r("3", "😂"), r("4", "😂")]} me={ME} mine={false} onToggle={() => {}} />);
    expect(motions()).toEqual({ "👍": "", "😂": "bump" });
  });

  it("does not replay on a re-render with the same reactions, nor when one is taken back", () => {
    const reactions = [r("2", "👍"), r("3", "😂")];
    const { rerender } = render(<ReactionBadges reactions={[r("2", "👍")]} me={ME} mine={false} onToggle={() => {}} />);
    rerender(<ReactionBadges reactions={reactions} me={ME} mine={false} onToggle={() => {}} />);
    rerender(<ReactionBadges reactions={[...reactions]} me={ME} mine={false} onToggle={() => {}} />);
    expect(motions()["😂"]).toBe("pop");
    rerender(<ReactionBadges reactions={[r("2", "👍")]} me={ME} mine={false} onToggle={() => {}} />);
    expect(motions()).toEqual({ "👍": "" });
  });

  it("shows reactions that were there from the start without any motion", () => {
    render(<ReactionBadges reactions={[r("2", "👍"), r("3", "👍"), r("4", "😂")]} me={ME} mine={false} onToggle={() => {}} />);
    expect(Object.values(motions())).toEqual(["", ""]);
  });
});

describe("typing row", () => {
  it("keeps one fixed-height row, with the three dots only while typing is live", () => {
    const { container, rerender } = render(<TypingRow active={false} name="Alice" avatar={undefined} />);
    const rowClass = container.firstElementChild!.className;
    expect(rowClass).toContain("h-6");
    expect(container.querySelectorAll("[data-typing-dot]")).toHaveLength(0);

    rerender(<TypingRow active name="Alice" avatar={undefined} />);
    expect(container.firstElementChild!.className).toBe(rowClass);
    expect(container.querySelectorAll("[data-typing-dot]")).toHaveLength(3);
    expect(screen.getByRole("status", { name: "Alice is typing" })).toBeTruthy();

    rerender(<TypingRow active={false} name="Alice" avatar={undefined} />);
    expect(container.querySelectorAll("[data-typing-dot]")).toHaveLength(0);
    expect(container.firstElementChild!.className).toBe(rowClass);
  });

  it("animates only under motion-safe, so reduced motion keeps the dots still", () => {
    const { container } = render(<TypingRow active name="Alice" avatar={undefined} />);
    for (const dot of container.querySelectorAll("[data-typing-dot]")) {
      expect(dot.className).toMatch(/motion-safe:animate-chat-typing-\d/);
      expect(dot.className).not.toMatch(/(^|\s)animate-chat-typing/);
    }
    act(() => {});
  });
});
