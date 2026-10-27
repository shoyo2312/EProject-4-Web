import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MessageList } from "@/components/messages/thread/MessageList";
import type { MessageResponse } from "@/lib/api/conversations";

/*
 * jsdom does no layout, so there is no real scrolling here: the list's metrics are a fake the tests
 * drive by hand (`layout`), `scrollTo` is recorded and applied instantly, and ResizeObserver is a
 * stub the tests fire. What this proves is the logic — which button, when, and what clears it.
 * Smooth-scroll timing and real wheel/touch interruption are only covered in a real browser.
 */
const layout = { scrollHeight: 2000, clientHeight: 500, tops: {} as Record<string, number> };
const scrollTo = vi.fn();
let resizeCallback: (() => void) | null = null;

class StubResizeObserver {
  constructor(callback: () => void) {
    resizeCallback = callback;
  }
  observe() {}
  disconnect() {}
  unobserve() {}
}

beforeEach(() => {
  layout.scrollHeight = 2000;
  layout.clientHeight = 500;
  layout.tops = {};
  scrollTo.mockReset();
  resizeCallback = null;
  vi.stubGlobal("ResizeObserver", StubResizeObserver);
  vi.stubGlobal("matchMedia", media(false));

  const top = new WeakMap<object, number>();
  Object.defineProperty(HTMLElement.prototype, "scrollHeight", { configurable: true, get: () => layout.scrollHeight });
  Object.defineProperty(HTMLElement.prototype, "clientHeight", { configurable: true, get: () => layout.clientHeight });
  Object.defineProperty(HTMLElement.prototype, "scrollTop", {
    configurable: true,
    get() {
      return top.get(this) ?? 0;
    },
    set(value: number) {
      top.set(this, Math.max(0, Math.min(value, layout.scrollHeight - layout.clientHeight)));
    },
  });
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get() {
      return layout.tops[(this as HTMLElement).dataset.id ?? ""] ?? 0;
    },
  });
  HTMLElement.prototype.scrollTo = function (options?: ScrollToOptions | number) {
    scrollTo(options);
    // A smooth scroll is not applied instantly in a browser; tests move `scrollTop` themselves.
    if (typeof options === "object" && options.behavior !== "smooth" && options.top !== undefined) {
      (this as HTMLElement).scrollTop = options.top;
    }
  };
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

/** `reduced` answers prefers-reduced-motion; a pointer that can hover answers (hover: hover). */
const media = (reduced: boolean) => (query: string) => ({
  matches: query.includes("reduced-motion") ? reduced : true,
  addEventListener: () => {},
  removeEventListener: () => {},
});

const ME = "1";
const msg = (n: number, senderId = "2"): MessageResponse => ({
  id: String(n),
  conversationId: "c1",
  senderId,
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
});
const history = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => msg(from + i));

function mount(messages: MessageResponse[], extra: Partial<React.ComponentProps<typeof MessageList>> = {}) {
  const props = {
    me: ME,
    hasMore: false,
    loadingOlder: false,
    onLoadOlder: vi.fn(),
    onAtBottomChange: vi.fn(),
    peerName: "Alice",
    peerAvatar: undefined,
    onReact: vi.fn(),
    onReply: vi.fn(),
    onDelete: vi.fn(),
    ...extra,
  };
  const view = render(<MessageList messages={messages} {...props} />);
  const rerender = (next: MessageResponse[]) => view.rerender(<MessageList messages={next} {...props} />);
  const list = () => screen.getByRole("log");
  const scrollTop = () => list().scrollTop;
  const scrollBy = (top: number) => {
    act(() => {
      list().scrollTop = top;
      fireEvent.scroll(list());
    });
  };
  const jump = () => screen.queryByRole("button", { name: /scroll to the latest/i });
  return { props, rerender, list, scrollTop, scrollBy, jump };
}

describe("MessageList jump button", () => {
  it("opens at the newest message with no button", () => {
    const { scrollTop, jump } = mount(history(1, 20));
    expect(scrollTop()).toBe(1500);
    expect(jump()).toBeNull();
  });

  it("shows an arrow when the reader scrolls up and nothing new has come", () => {
    const { scrollBy, jump } = mount(history(1, 20));
    scrollBy(300);
    expect(jump()?.getAttribute("aria-label")).toBe("Scroll to the latest messages");
  });

  it("keeps the place and turns into the sender's avatar when a message arrives above", () => {
    const { scrollBy, rerender, scrollTop, jump } = mount(history(1, 20));
    scrollBy(300);

    layout.scrollHeight = 2060;
    rerender(history(1, 21));

    expect(scrollTop()).toBe(300);
    expect(jump()?.getAttribute("aria-label")).toBe("New message from Alice. Scroll to the latest messages");
  });

  it("does not multiply the button or change its meaning when more arrive", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    rerender(history(1, 21));
    rerender(history(1, 22));
    expect(screen.getAllByRole("button", { name: /new message|scroll to the latest/i })).toHaveLength(1);
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);
  });

  it("treats a frame delivered twice as nothing new", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    rerender(history(1, 20).map((m) => ({ ...m })));
    expect(jump()?.getAttribute("aria-label")).toBe("Scroll to the latest messages");
  });

  it("is not raised by the reader's own message, which also takes them to the bottom", () => {
    const { scrollBy, rerender, scrollTop, jump } = mount(history(1, 20));
    scrollBy(300);
    layout.scrollHeight = 2060;
    rerender([...history(1, 20), msg(21, ME)]);
    expect(scrollTop()).toBe(1560);
    expect(jump()).toBeNull();
  });

  it("follows a new message while the reader is at the bottom, with no button", () => {
    const { rerender, scrollTop, jump } = mount(history(1, 20));
    layout.scrollHeight = 2060;
    rerender(history(1, 21));
    expect(scrollTop()).toBe(1560);
    expect(jump()).toBeNull();
  });

  it("follows within the following distance but not beyond it", () => {
    const { scrollBy, rerender, scrollTop } = mount(history(1, 20));
    scrollBy(1500 - 60); // 60px above the bottom: still following
    layout.scrollHeight = 2060;
    rerender(history(1, 21));
    expect(scrollTop()).toBe(1560);

    scrollBy(1560 - 200); // well above
    layout.scrollHeight = 2120;
    rerender(history(1, 22));
    expect(scrollTop()).toBe(1360);
  });

  it("clicking scrolls smoothly but does not clear anything until the bottom is reached", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    layout.scrollHeight = 2060;
    rerender(history(1, 21));

    fireEvent.click(jump()!);
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2060, behavior: "smooth" });
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);

    scrollBy(900); // half way there
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);

    scrollBy(1560); // arrived
    expect(jump()).toBeNull();
  });

  it("keeps the signal when the reader interrupts the scroll half way", () => {
    const { scrollBy, rerender, list, jump } = mount(history(1, 20));
    scrollBy(300);
    rerender(history(1, 21));
    fireEvent.click(jump()!);

    fireEvent.wheel(list());
    scrollBy(700);

    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);
  });

  it("aims again, and keeps the signal, when a message lands during the scroll", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    fireEvent.click(jump()!);
    scrollTo.mockClear();

    layout.scrollHeight = 2060;
    rerender(history(1, 21));

    expect(scrollTo).toHaveBeenCalledWith({ top: 2060, behavior: "smooth" });
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);

    scrollBy(1560);
    expect(jump()).toBeNull();
  });

  it("clears when the reader scrolls to the bottom themself, and an arrow comes back on scrolling up", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    rerender(history(1, 21));

    scrollBy(1500);
    expect(jump()).toBeNull();

    scrollBy(400);
    expect(jump()?.getAttribute("aria-label")).toBe("Scroll to the latest messages");
  });

  it("does not count a message as seen when only part of it is on screen", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);
    layout.scrollHeight = 2100;
    rerender(history(1, 21));

    scrollBy(2100 - 500 - 60); // 60px short: close enough to follow, not close enough to be seen
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);
  });

  it("uses an instant scroll when the user prefers reduced motion", () => {
    vi.stubGlobal("matchMedia", media(true));
    const { scrollBy, jump, scrollTop } = mount(history(1, 20));
    scrollBy(300);
    fireEvent.click(jump()!);
    // `scrollHeight` as the target: the browser clamps it to the real bottom, as the stub does.
    expect(scrollTo).toHaveBeenLastCalledWith({ top: 2000, behavior: "auto" });
    expect(scrollTop()).toBe(1500);
  });
});

describe("MessageList history and layout", () => {
  it("keeps the reader's place when older history is prepended, and raises nothing", () => {
    const { scrollBy, rerender, scrollTop, jump } = mount(history(11, 30));
    layout.tops = { "11": 0 };
    scrollBy(300);
    // render the same list once more so the old first message's position is recorded
    rerender(history(11, 30).map((m) => ({ ...m })));

    layout.scrollHeight = 2800;
    layout.tops = { "11": 800 }; // the old first message moved down by 800
    rerender(history(1, 30));

    expect(scrollTop()).toBe(1100);
    expect(jump()?.getAttribute("aria-label")).toBe("Scroll to the latest messages");
  });

  it("keeps the place and still notices a message that arrives in the same update as older history", () => {
    const { scrollBy, rerender, scrollTop, jump } = mount(history(11, 30));
    layout.tops = { "11": 0 };
    scrollBy(300);
    rerender(history(11, 30).map((m) => ({ ...m })));

    layout.scrollHeight = 2900;
    layout.tops = { "11": 800 };
    rerender(history(1, 31));

    expect(scrollTop()).toBe(1100);
    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);
  });

  it("asks for older history near the top", () => {
    const { scrollBy, props } = mount(history(11, 30), { hasMore: true });
    scrollBy(100);
    expect(props.onLoadOlder).toHaveBeenCalled();
  });

  it("hides the button when the content no longer needs scrolling", () => {
    const { scrollBy, jump } = mount(history(1, 20));
    scrollBy(300);
    expect(jump()).not.toBeNull();

    layout.scrollHeight = 400;
    act(() => resizeCallback?.());
    expect(jump()).toBeNull();
  });

  it("stays at the bottom when the panel gets shorter", () => {
    const { scrollTop } = mount(history(1, 20));
    layout.clientHeight = 300;
    layout.scrollHeight = 2000;
    act(() => resizeCallback?.());
    expect(scrollTop()).toBe(1700);
  });

  it("holds the reader's place when the panel resizes while they read above", () => {
    const { scrollBy, scrollTop, jump } = mount(history(1, 20));
    scrollBy(300);
    layout.clientHeight = 400;
    act(() => resizeCallback?.());
    expect(scrollTop()).toBe(300);
    expect(jump()).not.toBeNull();
  });

  it("starts clean for another thread: no avatar carried over", () => {
    const first = mount(history(1, 20));
    first.scrollBy(300);
    first.rerender(history(1, 21));
    expect(first.jump()?.getAttribute("aria-label")).toMatch(/New message/);
    cleanup();

    const second = mount(history(100, 120));
    expect(second.jump()).toBeNull();
    second.scrollBy(300);
    expect(second.jump()?.getAttribute("aria-label")).toBe("Scroll to the latest messages");
  });

  it("reports whether the newest message is really in view", () => {
    const { scrollBy, props } = mount(history(1, 20));
    expect(props.onAtBottomChange).toHaveBeenLastCalledWith(true);

    scrollBy(300);
    expect(props.onAtBottomChange).toHaveBeenLastCalledWith(false);

    scrollBy(1500 - 60); // following distance, not yet seen
    expect(props.onAtBottomChange).toHaveBeenLastCalledWith(false);

    scrollBy(1500);
    expect(props.onAtBottomChange).toHaveBeenLastCalledWith(true);
  });
});

describe("MessageList stickers", () => {
  const sticker = (n: number, senderId = "2"): MessageResponse => ({
    ...msg(n, senderId),
    type: "STICKER",
    content: null,
    stickerId: "fire",
    sticker: { stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 },
  });

  it("draws a sticker as a picture, and text as text, in order", () => {
    mount([msg(1), sticker(2), msg(3, ME)]);

    expect(screen.getByText("message 1")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Fire" }).getAttribute("src")).toBe("http://x/fire.png");
    expect(screen.getByText("message 3")).toBeTruthy();
  });

  it("treats a sticker from the other side as a new message while the reader is above", () => {
    const { scrollBy, rerender, jump } = mount(history(1, 20));
    scrollBy(300);

    layout.scrollHeight = 2200;
    rerender([...history(1, 20), sticker(21)]);

    expect(jump()?.getAttribute("aria-label")).toMatch(/New message from Alice/);
  });

  it("follows a sticker the reader sent, like any message of theirs", () => {
    const { scrollBy, rerender, scrollTop } = mount(history(1, 20));
    scrollBy(300);

    layout.scrollHeight = 2200;
    rerender([...history(1, 20), sticker(21, ME)]);

    expect(scrollTop()).toBe(1700);
  });

  it("shows a sticker the catalog no longer knows as unavailable instead of dropping it", () => {
    mount([{ ...sticker(1), sticker: null }]);
    expect(screen.getByRole("img", { name: "Sticker unavailable" })).toBeTruthy();
  });
});

describe("MessageList message actions", () => {
  const quote = (over: Partial<NonNullable<MessageResponse["replyTo"]>> = {}) => ({
    messageId: "1",
    state: "OK" as const,
    senderId: "2",
    type: "TEXT" as const,
    content: "the original",
    sticker: null,
    ...over,
  });

  it("offers react, reply and delete on a message", () => {
    mount([msg(1)]);
    expect(screen.getByRole("button", { name: "React to message" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Reply" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Delete message" })).toBeTruthy();
  });

  it("hands the message to the reply and delete callbacks", () => {
    const onReply = vi.fn();
    const onDelete = vi.fn();
    mount([msg(1)], { onReply, onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Reply" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete message" }));
    expect(onReply).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }));
  });

  it("picks a reaction from the picker, which closes after", () => {
    const onReact = vi.fn();
    mount([msg(1)], { onReact });
    fireEvent.click(screen.getByRole("button", { name: "React to message" }));
    fireEvent.click(screen.getByRole("button", { name: "React \u{1F44D}" }));
    expect(onReact).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }), "\u{1F44D}");
    expect(screen.queryByRole("dialog", { name: "Choose a reaction" })).toBeNull();
  });

  it("draws the picker in the document body, outside the clipping history", () => {
    mount([msg(1)]);
    fireEvent.click(screen.getByRole("button", { name: "React to message" }));
    const picker = screen.getByRole("dialog", { name: "Choose a reaction" });
    expect(screen.getByRole("log").contains(picker)).toBe(false);
  });

  it("shows reaction pills; pressing one's own takes it back", () => {
    const onReact = vi.fn();
    const reacted = { ...msg(1), reactions: [{ userId: ME, emoji: "\u{1F44D}" }, { userId: "2", emoji: "\u{1F44D}" }] };
    mount([reacted], { onReact });
    fireEvent.click(screen.getByRole("button", { name: "\u{1F44D} 2, yours — press to remove" }));
    expect(onReact).toHaveBeenCalledWith(expect.objectContaining({ id: "1" }), "\u{1F44D}");
  });

  it("labels a reply and shows its quote", () => {
    mount([{ ...msg(2, ME), replyToMessageId: "1", replyTo: quote() }]);
    expect(screen.getByText("You replied")).toBeTruthy();
    expect(screen.getByText("the original")).toBeTruthy();
  });

  it("says a quote was recalled or is unavailable instead of showing text", () => {
    mount([
      { ...msg(2), replyToMessageId: "1", replyTo: quote({ state: "RECALLED", content: null, type: null }) },
      { ...msg(3), replyToMessageId: "9", replyTo: quote({ messageId: "9", state: "UNAVAILABLE", senderId: null, content: null, type: null }) },
    ]);
    expect(screen.getByText("Message recalled")).toBeTruthy();
    expect(screen.getByText("Message unavailable")).toBeTruthy();
  });

  it("replaces a recalled message with a notice and keeps only delete", () => {
    mount([{ ...msg(1, ME), content: null, recalledAt: "2026-10-27T09:00:00Z" }]);
    expect(screen.getByText("You recalled a message")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Reply" })).toBeNull();
    expect(screen.queryByRole("button", { name: "React to message" })).toBeNull();
    expect(screen.getByRole("button", { name: "Delete message" })).toBeTruthy();
  });
});
