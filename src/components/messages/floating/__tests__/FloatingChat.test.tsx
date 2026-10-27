import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationResponse } from "@/lib/api/conversations";

const { chat, route } = vi.hoisted(() => ({
  chat: {
    conversations: [] as ConversationResponse[],
    byConversation: {} as Record<string, number>,
    authors: new Map(),
    nowMs: Date.parse("2026-10-27T09:00:00Z"),
  },
  route: { path: "/" },
}));

vi.mock("@/components/messages/ChatUnreadProvider", () => ({ useChatUnreadContext: () => chat }));
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: { userId: "1" } }) }));
vi.mock("next/navigation", () => ({ usePathname: () => route.path }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/messages/floating/FloatingPanel", () => ({
  FloatingPanel: ({ conversation, onMinimize, onClose }: { conversation: ConversationResponse; onMinimize: () => void; onClose: () => void }) => (
    <div data-testid="panel" data-id={conversation.id}>
      <button onClick={onMinimize}>minimize</button>
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

import { FloatingChat } from "@/components/messages/floating/FloatingChat";

const convo = (id: string, minute: number, over: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id,
  participantIds: ["1", `p${id}`],
  lastMessageContent: "x",
  lastMessageType: "TEXT",
  lastMessageSenderId: "2",
  lastMessageAt: new Date(Date.UTC(2026, 9, 27, 8, minute)).toISOString(),
  createdAt: null,
  hasUnread: true,
  requestState: null,
  initiatorId: null,
  sendPermission: "ALLOWED",
  retryAvailableAt: null,
  lastMessageRecalled: false,
  pinnedAt: null,
  muteMode: "NONE",
  mutedUntil: null,
  inboxHidden: false,
  ...over,
});

function setChat(list: ConversationResponse[]) {
  chat.conversations = list;
  chat.byConversation = Object.fromEntries(list.filter((c) => c.hasUnread).map((c) => [c.id, 2]));
  chat.authors = new Map(list.map((c) => [`p${c.id}`, { nickname: `Person ${c.id}`, avatarUrl: "" }]));
}

const bubbles = () => screen.queryAllByRole("button", { name: /^Person / });

beforeEach(() => {
  route.path = "/";
  setChat([]);
});
afterEach(cleanup);

describe("FloatingChat bubbles", () => {
  it("shows one bubble for one conversation with a new message, two for two", () => {
    setChat([convo("a", 5)]);
    const view = render(<FloatingChat />);
    expect(bubbles()).toHaveLength(1);

    setChat([convo("a", 5), convo("b", 4)]);
    view.rerender(<FloatingChat />);
    expect(bubbles()).toHaveLength(2);
    expect(screen.queryByLabelText(/more conversations/)).toBeNull();
  });

  it("does not add recent conversations that have nothing unread", () => {
    setChat([convo("a", 5), convo("b", 4, { hasUnread: false }), convo("c", 3, { hasUnread: false })]);
    render(<FloatingChat />);
    expect(bubbles()).toHaveLength(1);
  });

  it("shows only the three newest of more, and +N for the rest", () => {
    setChat([convo("a", 5), convo("b", 4), convo("c", 3), convo("d", 2), convo("e", 1)]);
    render(<FloatingChat />);
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person a", "Person b", "Person c"]);
    expect(screen.getByLabelText("2 more conversations").textContent).toBe("+2");
  });

  it("orders by newest message even when the inbox has a pinned older chat first", () => {
    setChat([convo("old", 1, { pinnedAt: "2026-10-27T08:30:00.000Z" }), convo("mid", 5), convo("new", 9)]);
    render(<FloatingChat />);
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person new", "Person mid", "Person old"]);
    expect(chat.conversations.map((c) => c.id)).toEqual(["old", "mid", "new"]);
  });

  it("brings a conversation from outside the three in when it gets the newest message", () => {
    const four = [convo("a", 40), convo("b", 30), convo("c", 20), convo("d", 10)];
    setChat(four);
    const view = render(<FloatingChat />);
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person a", "Person b", "Person c"]);

    setChat([convo("a", 40), convo("b", 30), convo("c", 20), convo("d", 55)]);
    view.rerender(<FloatingChat />);
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person d", "Person a", "Person b"]);
  });

  it("shows nothing for a muted conversation, and nothing at all on /messages", () => {
    setChat([convo("a", 5, { muteMode: "INDEFINITE" })]);
    const view = render(<FloatingChat />);
    expect(bubbles()).toHaveLength(0);

    setChat([convo("a", 5)]);
    route.path = "/messages/a";
    view.rerender(<FloatingChat />);
    expect(view.container.innerHTML).toBe("");
  });

  it("keeps the unread badge on the bubble", () => {
    setChat([convo("a", 5)]);
    render(<FloatingChat />);
    expect(screen.getByRole("button", { name: "Person a, 2 unread" })).toBeTruthy();
  });
});

describe("FloatingChat panel", () => {
  beforeEach(() => setChat([convo("a", 5), convo("b", 4), convo("c", 3)]));

  it("opens one panel at a time and switches it when another avatar is pressed", () => {
    render(<FloatingChat />);
    fireEvent.click(screen.getByRole("button", { name: "Person b, 2 unread" }));
    expect(screen.getAllByTestId("panel")).toHaveLength(1);
    expect(screen.getByTestId("panel").getAttribute("data-id")).toBe("b");
    // The open one is the panel, so it is no longer a bubble.
    expect(screen.queryByRole("button", { name: /Person b/ })).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Person c, 2 unread" }));
    expect(screen.getAllByTestId("panel")).toHaveLength(1);
    expect(screen.getByTestId("panel").getAttribute("data-id")).toBe("c");
    expect(screen.getByRole("button", { name: /Person b/ })).toBeTruthy();
  });

  it("minimising returns the panel to a bubble; closing hides it until a newer message", () => {
    const view = render(<FloatingChat />);
    fireEvent.click(screen.getByRole("button", { name: "Person a, 2 unread" }));
    fireEvent.click(screen.getByText("minimize"));
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(bubbles()).toHaveLength(3);

    fireEvent.click(screen.getByRole("button", { name: "Person a, 2 unread" }));
    fireEvent.click(screen.getByText("close"));
    expect(screen.queryByTestId("panel")).toBeNull();
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person b", "Person c"]);

    setChat([convo("a", 9), convo("b", 4), convo("c", 3)]);
    view.rerender(<FloatingChat />);
    expect(bubbles().map((b) => b.getAttribute("title"))).toEqual(["Person a", "Person b", "Person c"]);
  });
});
