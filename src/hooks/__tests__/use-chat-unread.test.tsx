import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationResponse } from "@/lib/api/conversations";
import { setViewing } from "@/lib/chat-viewing";

const api = vi.hoisted(() => ({
  listConversations: vi.fn(),
  listMessageRequests: vi.fn(),
  listMessages: vi.fn(),
  pinConversation: vi.fn(),
  muteConversation: vi.fn(),
  deleteConversationForMe: vi.fn(),
  queue: { handler: null as ((body: string) => void) | null },
  notify: vi.fn(),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listConversations: (...a: unknown[]) => api.listConversations(...a),
  listMessageRequests: (...a: unknown[]) => api.listMessageRequests(...a),
  listMessages: (...a: unknown[]) => api.listMessages(...a),
  pinConversation: (...a: unknown[]) => api.pinConversation(...a),
  muteConversation: (...a: unknown[]) => api.muteConversation(...a),
  deleteConversationForMe: (...a: unknown[]) => api.deleteConversationForMe(...a),
}));
vi.mock("@/lib/api/authors", () => ({ resolveAuthors: () => Promise.resolve(new Map()) }));
vi.mock("@/lib/realtime/stompClient", () => ({
  subscribeTopic: (destination: string, handler: (body: string) => void) => {
    if (destination === "/user/queue/chat") api.queue.handler = handler;
    return () => {
      api.queue.handler = null;
    };
  },
  onStompConnect: () => () => {},
}));
vi.mock("@/lib/settings/browser-notifications", () => ({ showBrowserNotification: (n: unknown) => api.notify(n) }));

import { useChatUnread } from "@/hooks/use-chat-unread";

const convo = (id: string, over: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id,
  participantIds: ["1", `p${id}`],
  lastMessageContent: "old",
  lastMessageType: "TEXT",
  lastMessageSenderId: "1",
  lastMessageAt: "2026-10-27T08:00:00.000Z",
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
  ...over,
});

const incoming = (conversationId: string, id: string, content = "hello") =>
  JSON.stringify({
    type: "MESSAGE",
    conversationId,
    message: {
      id,
      conversationId,
      senderId: 2,
      type: "TEXT",
      content,
      sentAt: new Date().toISOString(),
    },
  });

const flush = () => act(async () => {});

async function open(rows: ConversationResponse[]) {
  api.listConversations.mockResolvedValue(rows);
  const hook = renderHook(() => useChatUnread("1"));
  await flush();
  return hook;
}

beforeEach(() => {
  for (const fn of Object.values(api)) if (typeof fn === "function" && "mockReset" in fn) fn.mockReset();
  api.queue.handler = null;
  api.listMessageRequests.mockResolvedValue([]);
  api.listMessages.mockResolvedValue({ items: [], nextCursor: null, hasMore: false });
  setViewing("a", false);
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("alerts for a new message", () => {
  it("raises one for an unmuted conversation, once even when the frame is delivered twice", async () => {
    const { result } = await open([convo("a")]);
    act(() => api.queue.handler?.(incoming("a", "m1")));
    act(() => api.queue.handler?.(incoming("a", "m1")));

    expect(api.notify).toHaveBeenCalledTimes(1);
    expect(api.notify).toHaveBeenCalledWith(expect.objectContaining({ id: "chat-a", body: "hello" }));
    expect(result.current.byConversation.a).toBe(1);
  });

  it("raises none while muted — and still counts, previews and orders the message", async () => {
    const { result } = await open([convo("a", { muteMode: "INDEFINITE" }), convo("b", { lastMessageAt: "2026-10-27T09:00:00.000Z" })]);

    act(() => api.queue.handler?.(incoming("a", "m1", "while muted")));

    expect(api.notify).not.toHaveBeenCalled();
    expect(result.current.total).toBe(1);
    expect(result.current.byConversation.a).toBe(1);
    expect(result.current.conversations[0]).toMatchObject({ id: "a", lastMessageContent: "while muted", hasUnread: true });
  });

  it("raises none for a thread that is being looked at", async () => {
    vi.spyOn(document, "hasFocus").mockReturnValue(true);
    await open([convo("a")]);
    setViewing("a", true);
    act(() => api.queue.handler?.(incoming("a", "m1")));
    expect(api.notify).not.toHaveBeenCalled();
  });

  it("raises one again once a timed mute has ended, but nothing is made up for what arrived during it", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-27T10:00:00Z"));
    await open([convo("a", { muteMode: "TIMED", mutedUntil: "2026-10-27T11:00:00.000Z" })]);

    act(() => api.queue.handler?.(incoming("a", "during")));
    expect(api.notify).not.toHaveBeenCalled();

    vi.setSystemTime(new Date("2026-10-27T11:00:01Z"));
    expect(api.notify).not.toHaveBeenCalled();
    act(() => api.queue.handler?.(incoming("a", "after")));
    expect(api.notify).toHaveBeenCalledTimes(1);
    expect(api.notify).toHaveBeenCalledWith(expect.objectContaining({ id: "chat-a" }));
  });
});

describe("the viewer's own pin, mute and delete", () => {
  it("pin puts the chat on top of the list and keeps it there when others get messages", async () => {
    const { result } = await open([convo("a"), convo("b", { lastMessageAt: "2026-10-27T07:00:00.000Z" })]);
    api.pinConversation.mockResolvedValue(convo("b", { pinnedAt: "2026-10-27T08:30:00.000Z", lastMessageAt: "2026-10-27T07:00:00.000Z" }));

    await act(async () => void (await result.current.pin("b")));
    expect(result.current.conversations.map((c) => c.id)).toEqual(["b", "a"]);

    act(() => api.queue.handler?.(incoming("a", "m1")));
    expect(result.current.conversations.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("surfaces the server's refusal and changes nothing", async () => {
    const { result } = await open([convo("a")]);
    api.pinConversation.mockRejectedValue(new Error("PIN_LIMIT_REACHED"));
    await expect(result.current.pin("a")).rejects.toThrow();
    expect(result.current.conversations[0].pinnedAt).toBeNull();
  });

  it("delete removes the chat and its unread count, and a pushed removal from another tab does the same", async () => {
    const { result } = await open([convo("a"), convo("b")]);
    act(() => api.queue.handler?.(incoming("a", "m1")));
    act(() => api.queue.handler?.(incoming("b", "m2")));
    expect(result.current.total).toBe(2);

    api.deleteConversationForMe.mockResolvedValue(null);
    await act(async () => result.current.deleteConversation("a"));
    expect(result.current.conversations.map((c) => c.id)).toEqual(["b"]);
    expect(result.current.total).toBe(1);

    act(() => api.queue.handler?.(JSON.stringify({ type: "CONVERSATION_REMOVED", conversationId: "b" })));
    expect(result.current.conversations).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it("a failed delete leaves everything as it was", async () => {
    const { result } = await open([convo("a")]);
    api.deleteConversationForMe.mockRejectedValue(new Error("offline"));
    await expect(result.current.deleteConversation("a")).rejects.toThrow();
    expect(result.current.conversations.map((c) => c.id)).toEqual(["a"]);
  });

  it("a resync that was already under way does not undo a mute the server just confirmed", async () => {
    const { result } = await open([convo("a")]);
    let releaseStale: (rows: ConversationResponse[]) => void = () => {};
    api.listConversations
      .mockReturnValueOnce(new Promise<ConversationResponse[]>((resolve) => (releaseStale = resolve)))
      .mockResolvedValue([convo("a", { muteMode: "INDEFINITE" })]);
    api.muteConversation.mockResolvedValue(convo("a", { muteMode: "INDEFINITE" }));

    act(() => result.current.reload());
    await act(async () => void (await result.current.mute("a", "INDEFINITE")));
    await act(async () => releaseStale([convo("a")])); // the old answer, arriving late
    await flush();

    expect(result.current.conversations[0].muteMode).toBe("INDEFINITE");
  });

  it("remembers a block for the conversation so its composer can close", async () => {
    const { result } = await open([convo("a")]);
    act(() => result.current.markBlocked("a"));
    expect(result.current.blocked.has("a")).toBe(true);
  });
});
