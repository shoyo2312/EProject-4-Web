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
  getBlocked: vi.fn(),
  acknowledgeDelivered: vi.fn(),
  setFollowState: vi.fn(),
  setFollowRequested: vi.fn(),
}));
vi.mock("@/lib/api/users", () => ({
  getBlocked: (...a: unknown[]) => api.getBlocked(...a),
  setFollowState: (...a: unknown[]) => api.setFollowState(...a),
  setFollowRequested: (...a: unknown[]) => api.setFollowRequested(...a),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listConversations: (...a: unknown[]) => api.listConversations(...a),
  listMessageRequests: (...a: unknown[]) => api.listMessageRequests(...a),
  listMessages: (...a: unknown[]) => api.listMessages(...a),
  acknowledgeDelivered: (...a: unknown[]) => api.acknowledgeDelivered(...a),
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
  blockedByViewer: false,
  messagingBlocked: false,
  blockVersion: 0,
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
  api.acknowledgeDelivered.mockImplementation(async (_id: string, ids: string[]) => ({
    userId: "1",
    delivered: { messageId: ids[ids.length - 1], sentAt: "2999-01-01T00:00:00.000Z", at: "2999-01-01T00:00:00.000Z" },
    read: null,
  }));
  api.getBlocked.mockResolvedValue({ content: [], page: { size: 100, number: 0, totalElements: 0, totalPages: 1 } });
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

  it("knows who the viewer blocked from the server, so it survives a reload", async () => {
    api.getBlocked.mockResolvedValue({
      content: [{ userId: 9002 }],
      page: { size: 100, number: 0, totalElements: 1, totalPages: 1 },
    });
    const { result } = await open([convo("a")]);
    expect(result.current.blockedUsers.has("9002")).toBe(true);
    expect(result.current.blockedUsers.has("9003")).toBe(false);
  });

  it("follows the viewer's own block and unblock at once", async () => {
    const { result } = await open([convo("a")]);
    act(() => result.current.setBlockedUser("9002", true));
    expect(result.current.blockedUsers.has("9002")).toBe(true);
    act(() => result.current.setBlockedUser("9002", false));
    expect(result.current.blockedUsers.has("9002")).toBe(false);
  });

  it("keeps the last known blocked list when it cannot be read", async () => {
    api.getBlocked.mockResolvedValueOnce({
      content: [{ userId: 9002 }],
      page: { size: 100, number: 0, totalElements: 1, totalPages: 1 },
    });
    const { result } = await open([convo("a")]);
    api.getBlocked.mockRejectedValue(new Error("offline"));
    await act(async () => result.current.reload());
    expect(result.current.blockedUsers.has("9002")).toBe(true);
  });

  const frame = (conversation: ConversationResponse) =>
    JSON.stringify({ type: "CONVERSATION", conversation: { ...conversation, participantIds: [1, 9002] } });
  const blockedBy = (version: number, mine: boolean, closed = true) =>
    convo("a", { participantIds: ["1", "9002"], blockedByViewer: mine, messagingBlocked: closed, blockVersion: version });

  it("closes an open conversation for both sides from a pushed frame, with no send attempted", async () => {
    const { result } = await open([convo("a", { participantIds: ["1", "9002"] })]);
    act(() => api.queue.handler?.(frame(blockedBy(5, false))));
    expect(result.current.conversations[0].messagingBlocked).toBe(true);
    expect(result.current.conversations[0].blockedByViewer).toBe(false);
    // The follow cache of the side that was blocked is cleared too.
    expect(api.setFollowState).toHaveBeenCalledWith("9002", false);
    expect(api.setFollowRequested).toHaveBeenCalledWith("9002", false);
  });

  it("a duplicate or older frame cannot bring a block back or take it away", async () => {
    const { result } = await open([convo("a", { participantIds: ["1", "9002"] })]);
    act(() => api.queue.handler?.(frame(blockedBy(6, true))));
    act(() => api.queue.handler?.(frame(blockedBy(6, true))));
    act(() => api.queue.handler?.(frame(blockedBy(5, false, false))));
    expect(result.current.conversations[0].blockedByViewer).toBe(true);
    expect(result.current.conversations[0].blockVersion).toBe(6);
    act(() => api.queue.handler?.(frame(blockedBy(7, false, false))));
    expect(result.current.conversations[0].blockedByViewer).toBe(false);
  });

  it("a resync that answers with an older state keeps the newer block", async () => {
    const { result } = await open([convo("a", { participantIds: ["1", "9002"] })]);
    act(() => api.queue.handler?.(frame(blockedBy(6, true))));
    api.listConversations.mockResolvedValue([blockedBy(5, false, false)]);
    await act(async () => result.current.reload());
    expect(result.current.conversations[0].blockedByViewer).toBe(true);
  });

  it("an unblock that leaves the other side's block in place keeps messaging closed", async () => {
    const { result } = await open([convo("a", { participantIds: ["1", "9002"] })]);
    act(() => api.queue.handler?.(frame(blockedBy(6, true))));
    act(() => api.queue.handler?.(frame(blockedBy(7, false, true))));
    expect(result.current.conversations[0].blockedByViewer).toBe(false);
    expect(result.current.conversations[0].messagingBlocked).toBe(true);
  });
});

describe("telling the sender a message arrived", () => {
  const sentAt = (second: number) => new Date(Date.UTC(2026, 9, 28, 8, 0, second)).toISOString();
  const frameAt = (id: string, second: number, senderId = 2, conversationId = "a") =>
    JSON.stringify({
      type: "MESSAGE",
      conversationId,
      message: { id, conversationId, senderId, type: "TEXT", content: "hi", sentAt: sentAt(second) },
    });

  beforeEach(() => vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] }));

  it("names the message it received, once, however many times the frame comes", async () => {
    await open([convo("a")]);
    act(() => api.queue.handler?.(frameAt("m1", 1)));
    act(() => api.queue.handler?.(frameAt("m1", 1)));
    expect(api.acknowledgeDelivered).not.toHaveBeenCalled();

    await act(async () => void vi.advanceTimersByTime(400));

    expect(api.acknowledgeDelivered).toHaveBeenCalledTimes(1);
    expect(api.acknowledgeDelivered).toHaveBeenCalledWith("a", ["m1"]);
  });

  it("answers a burst with one request that names every message in order", async () => {
    await open([convo("a")]);
    for (let i = 1; i <= 4; i += 1) {
      act(() => api.queue.handler?.(frameAt(`m${i}`, i)));
      await act(async () => void vi.advanceTimersByTime(100));
    }
    await act(async () => void vi.advanceTimersByTime(400));

    expect(api.acknowledgeDelivered).toHaveBeenCalledTimes(1);
    expect(api.acknowledgeDelivered).toHaveBeenCalledWith("a", ["m1", "m2", "m3", "m4"]);
  });

  it("never acknowledges the viewer's own message", async () => {
    await open([convo("a")]);
    act(() => api.queue.handler?.(frameAt("m9", 1, 1)));
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(api.acknowledgeDelivered).not.toHaveBeenCalled();
  });

  it("is not a read: the unread count is untouched by receiving", async () => {
    const { result } = await open([convo("a")]);
    const before = result.current.total;
    act(() => api.queue.handler?.(frameAt("m1", 1)));
    await act(async () => void vi.advanceTimersByTime(400));
    expect(result.current.total).toBe(before + 1);
  });

  it("what arrived while away is acknowledged only after it has been read from the server", async () => {
    api.listMessages.mockResolvedValue({
      items: [
        { id: "m2", conversationId: "a", senderId: 2, type: "TEXT", content: "b", sentAt: sentAt(2) },
        { id: "m1", conversationId: "a", senderId: 2, type: "TEXT", content: "a", sentAt: sentAt(1) },
      ],
      nextCursor: null,
      hasMore: false,
    });
    await open([convo("a", { hasUnread: true, lastMessageSenderId: "pa", lastMessageAt: sentAt(2) })]);
    expect(api.acknowledgeDelivered).not.toHaveBeenCalled();

    await act(async () => void vi.advanceTimersByTime(400));

    expect(api.listMessages).toHaveBeenCalled();
    expect(api.acknowledgeDelivered).toHaveBeenCalledWith("a", ["m1", "m2"]);
  });

  it("a conversation that merely appears in the list, with nothing unread, is not acknowledged", async () => {
    await open([convo("read", { hasUnread: false, lastMessageSenderId: "pb" }), convo("mine", { hasUnread: true, lastMessageSenderId: "1" })]);
    await act(async () => void vi.advanceTimersByTime(2_000));
    expect(api.acknowledgeDelivered).not.toHaveBeenCalled();
  });

  it("signing out cancels what is waiting: nothing is sent for the account that left", async () => {
    api.listConversations.mockResolvedValue([convo("a")]);
    const view = renderHook(({ me }: { me: string | null }) => useChatUnread(me), { initialProps: { me: "1" as string | null } });
    await flush();
    act(() => api.queue.handler?.(frameAt("m1", 1)));

    view.rerender({ me: null });
    await act(async () => void vi.advanceTimersByTime(5_000));

    expect(api.acknowledgeDelivered).not.toHaveBeenCalled();
  });

  it("switching accounts does not carry the first account's messages to the second", async () => {
    api.listConversations.mockResolvedValue([convo("a")]);
    const view = renderHook(({ me }: { me: string | null }) => useChatUnread(me), { initialProps: { me: "1" as string | null } });
    await flush();
    act(() => api.queue.handler?.(frameAt("m1", 1)));

    view.rerender({ me: "9" });
    await flush();
    await act(async () => void vi.advanceTimersByTime(5_000));

    expect(api.acknowledgeDelivered).not.toHaveBeenCalledWith("a", ["m1"]);
  });
});
