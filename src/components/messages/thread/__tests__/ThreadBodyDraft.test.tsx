import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatThread } from "@/hooks/use-chat-thread";
import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { flushDrafts, getDraft, resetDraftsForTest, saveDraft } from "@/lib/chat-drafts";

vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/components/messages/ChatUnreadProvider", () => ({
  useChatUnreadContext: () => ({
    applyConversation: vi.fn(),
    blockedUsers: new Set<string>(),
    setBlockedUser: vi.fn(),
    acceptRequest: vi.fn(),
    declineRequest: vi.fn(),
    requests: [],
    reload: vi.fn(),
  }),
}));
vi.mock("@/components/messages/thread/MessageList", () => ({ MessageList: () => <div role="log" /> }));
vi.mock("@/lib/realtime/stompClient", () => ({
  publishStomp: () => true,
  onStompDisconnect: () => () => {},
  onStompConnect: () => () => {},
  subscribeTopic: () => () => {},
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { ThreadBody } from "@/components/messages/thread/ThreadBody";

const msg: MessageResponse = {
  id: "1",
  conversationId: "A",
  senderId: "2",
  type: "TEXT",
  content: "hi",
  stickerId: null,
  sticker: null,
  sentAt: "2026-10-27T08:00:00.000Z",
  replyToMessageId: null,
  replyTo: null,
  recalledAt: null,
  reactions: [],
  revision: 0,
};

const conversation = (id: string): ConversationResponse => ({
  id,
  participantIds: ["1", "2"],
  lastMessageContent: "hi",
  lastMessageType: "TEXT",
  lastMessageSenderId: "2",
  lastMessageAt: msg.sentAt,
  createdAt: null,
  hasUnread: false,
  requestState: null,
  initiatorId: null,
  sendPermission: "ALLOWED",
  retryAvailableAt: null,
  lastMessageRecalled: false,
  pinnedAt: null,
  muteMode: "NONE",
  mutedUntil: null,
  inboxHidden: false,
  blockedByViewer: null,
  messagingBlocked: null,
  blockVersion: 0,
});

const thread = (send: ChatThread["send"] = vi.fn()): ChatThread => ({
  messages: [msg],
  status: "ready",
  hasMore: false,
  loadingOlder: false,
  loadOlder: vi.fn(),
  retry: vi.fn(),
  markSeen: vi.fn(),
  send,
  react: vi.fn(),
  recall: vi.fn(),
  hide: vi.fn(),
});

const open = (id: string, me = "1", t = thread()) =>
  render(<ThreadBody key={id} conversation={conversation(id)} thread={t} me={me} name="Alice" avatar={undefined} />);

const box = () => screen.getByRole("textbox", { name: "Message" }) as HTMLTextAreaElement;
const type = (text: string) => fireEvent.change(box(), { target: { value: text } });

beforeEach(() => {
  window.localStorage.clear();
  resetDraftsForTest();
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ThreadBody message drafts", () => {
  it("restores unsent text when the conversation is opened again", () => {
    const first = open("A");
    type("abc");
    first.unmount();

    open("B");
    expect(box().value).toBe("");
    cleanup();

    open("A");
    expect(box().value).toBe("abc");
  });

  it("writes the draft to storage when the thread closes, so a reload keeps it", () => {
    const view = open("A");
    type("abc");
    view.unmount();

    expect(JSON.parse(window.localStorage.getItem("tt:chat-drafts:v1:1") ?? "{}")).toEqual({ A: "abc" });
    resetDraftsForTest();
    open("A");
    expect(box().value).toBe("abc");
  });

  it("keeps each conversation's draft apart through A → B → C → A", () => {
    let view = open("A");
    type("abc");
    view.unmount();
    view = open("B");
    type("hello");
    view.unmount();
    view = open("C");
    expect(box().value).toBe("");
    view.unmount();
    open("A");
    expect(box().value).toBe("abc");
    expect(getDraft("1", "B")).toBe("hello");
    expect(getDraft("1", "C")).toBe("");
  });

  it("drops the draft when the box is emptied", () => {
    open("A");
    type("abc");
    expect(getDraft("1", "A")).toBe("abc");
    type("");
    expect(getDraft("1", "A")).toBe("");
  });

  it("clears the draft only once the send has succeeded", async () => {
    let finish: (value: { ok: true; message: MessageResponse }) => void = () => {};
    const send = vi.fn(() => new Promise<{ ok: true; message: MessageResponse }>((resolve) => (finish = resolve)));
    open("A", "1", thread(send as unknown as ChatThread["send"]));
    type("abcdef");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(send).toHaveBeenCalledWith({ type: "TEXT", content: "abcdef" }));
    expect(getDraft("1", "A")).toBe("abcdef");

    finish({ ok: true, message: { ...msg, content: "abcdef", senderId: "1" } });
    await waitFor(() => expect(getDraft("1", "A")).toBe(""));
  });

  it("keeps the text, and the draft, when the send fails", async () => {
    const send = vi.fn(async () => ({ ok: false as const, error: new Error("offline") }));
    open("A", "1", thread(send as unknown as ChatThread["send"]));
    type("abcdef");
    fireEvent.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => expect(send).toHaveBeenCalled());
    await waitFor(() => expect(box().value).toBe("abcdef"));
    expect(getDraft("1", "A")).toBe("abcdef");
  });

  it("does not show one account's draft to another", () => {
    saveDraft("1", "A", "mine");
    flushDrafts();
    open("A", "9");
    expect(box().value).toBe("");
  });
});
