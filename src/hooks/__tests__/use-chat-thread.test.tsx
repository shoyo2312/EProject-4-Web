import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessagePage, MessageResponse } from "@/lib/api/conversations";
import { setViewing } from "@/lib/chat-viewing";

const { listMessages, markConversationRead, sendMessage, topic, queue, reactToMessage, removeReaction, recallMessage, hideMessage } = vi.hoisted(() => ({
  queue: { handler: null as ((body: string) => void) | null },
  reactToMessage: vi.fn(),
  removeReaction: vi.fn(),
  recallMessage: vi.fn(),
  hideMessage: vi.fn(),
  listMessages: vi.fn<(...args: unknown[]) => Promise<MessagePage>>(),
  markConversationRead: vi.fn<(id: string) => Promise<null>>(),
  sendMessage: vi.fn(),
  topic: { handler: null as ((body: string) => void) | null },
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listMessages: (...args: unknown[]) => listMessages(...args),
  markConversationRead: (id: string) => markConversationRead(id),
  sendMessage: (...args: unknown[]) => sendMessage(...args),
  reactToMessage: (...args: unknown[]) => reactToMessage(...args),
  removeReaction: (...args: unknown[]) => removeReaction(...args),
  recallMessage: (...args: unknown[]) => recallMessage(...args),
  hideMessage: (...args: unknown[]) => hideMessage(...args),
}));
vi.mock("@/lib/realtime/stompClient", () => ({
  // Only the conversation's own topic is tracked here; the viewer's queue (replies, updates) is not under test.
  subscribeTopic: (destination: string, handler: (body: string) => void) => {
    if (destination === "/user/queue/chat") {
      queue.handler = handler;
      return () => {
        queue.handler = null;
      };
    }
    if (!destination.startsWith("/topic/")) return () => {};
    topic.handler = handler;
    return () => {
      topic.handler = null;
    };
  },
  onStompConnect: () => () => {},
}));

import { useChatThread } from "@/hooks/use-chat-thread";

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
/** The server pages newest first. */
const page = (ids: number[], over: Partial<MessagePage> = {}): MessagePage => ({
  items: ids.map((n) => msg(n)).reverse(),
  nextCursor: null,
  hasMore: false,
  ...over,
});
const frame = (message: MessageResponse) => JSON.stringify(message);
const flush = () => act(async () => {});

beforeEach(() => {
  listMessages.mockReset();
  markConversationRead.mockReset().mockResolvedValue(null);
  sendMessage.mockReset();
  topic.handler = null;
  queue.handler = null;
  reactToMessage.mockReset();
  removeReaction.mockReset();
  recallMessage.mockReset();
  hideMessage.mockReset();
  setViewing("c1", false);
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

async function openThread() {
  listMessages.mockResolvedValueOnce(page([1, 2, 3]));
  const onRead = vi.fn();
  const hook = renderHook(() => useChatThread("c1", ME, onRead));
  await flush();
  return { ...hook, onRead };
}

describe("useChatThread", () => {
  it("loads the newest page oldest first", async () => {
    const { result } = await openThread();
    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "2", "3"]);
    expect(result.current.status).toBe("ready");
  });

  it("merges a live frame once, however many times it is delivered", async () => {
    const { result } = await openThread();

    act(() => topic.handler?.(frame(msg(4))));
    act(() => topic.handler?.(frame(msg(4))));

    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("keeps 18-digit sender ids exact, so the reader's own message is recognised", async () => {
    const { result } = await openThread();
    const sent = '{"id":"9","conversationId":"c1","senderId":372385859884797952,"content":"mine","sentAt":"2026-10-27T09:00:00Z"}';

    act(() => topic.handler?.(sent));

    expect(result.current.messages.at(-1)?.senderId).toBe("372385859884797952");
  });

  it("finds a message missed while the socket was down when the window is focused again", async () => {
    const { result } = await openThread();
    listMessages.mockResolvedValueOnce(page([1, 2, 3, 4, 5]));

    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    await flush();

    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("does not turn a refetch of what it already has into new messages", async () => {
    const { result } = await openThread();
    listMessages.mockResolvedValueOnce(page([1, 2, 3]));

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();

    expect(result.current.messages).toHaveLength(3);
  });

  it("prepends an older page without disturbing the newer ones", async () => {
    listMessages.mockResolvedValueOnce(page([21, 22, 23], { nextCursor: "cur", hasMore: true }));
    const { result } = renderHook(() => useChatThread("c1", ME, vi.fn()));
    await flush();

    listMessages.mockResolvedValueOnce(page([11, 12], { hasMore: false }));
    act(() => result.current.loadOlder());
    await flush();

    expect(result.current.messages.map((m) => m.id)).toEqual(["11", "12", "21", "22", "23"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("starts from nothing when the conversation changes", async () => {
    listMessages.mockResolvedValueOnce(page([1, 2, 3]));
    const hook = renderHook(({ id }) => useChatThread(id, ME, vi.fn()), { initialProps: { id: "c1" } });
    await flush();

    listMessages.mockResolvedValueOnce(page([50]));
    hook.rerender({ id: "c2" });
    await flush();

    expect(hook.result.current.messages.map((m) => m.id)).toEqual(["50"]);
  });
});

describe("useChatThread mark read", () => {
  it("does not mark a thread read that nobody is looking at", async () => {
    const { result } = await openThread();

    act(() => topic.handler?.(frame(msg(4))));
    act(() => result.current.markRead());

    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it("marks it read once the thread is on screen with the newest message in view", async () => {
    const { result, onRead } = await openThread();
    setViewing("c1", true);

    act(() => result.current.markRead());
    await flush();

    expect(markConversationRead).toHaveBeenCalledWith("c1");
    expect(onRead).toHaveBeenCalledWith("c1", msg(3).sentAt);
  });

  it("does not mark read while the window has lost focus, even if the thread is in view", async () => {
    const { result } = await openThread();
    setViewing("c1", true);
    vi.spyOn(document, "hasFocus").mockReturnValue(false);

    act(() => result.current.markRead());

    expect(markConversationRead).not.toHaveBeenCalled();
  });
});

describe("useChatThread stickers", () => {
  const stickerMessage = (n: number, senderId = "2"): MessageResponse => ({
    ...msg(n, senderId),
    type: "STICKER",
    content: null,
    stickerId: "fire",
    sticker: { stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 },
  });

  it("sends a sticker by id only, and merges the stored message", async () => {
    const { result } = await openThread();
    sendMessage.mockResolvedValueOnce(stickerMessage(4, ME));

    let outcome: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      outcome = await result.current.send({ type: "STICKER", stickerId: "fire" });
    });

    expect(sendMessage).toHaveBeenCalledWith("c1", { type: "STICKER", stickerId: "fire" });
    expect(outcome?.ok).toBe(true);
    expect(result.current.messages.at(-1)?.type).toBe("STICKER");
  });

  it("sends text as a TEXT payload", async () => {
    const { result } = await openThread();
    sendMessage.mockResolvedValueOnce(msg(4, ME));

    await act(async () => {
      await result.current.send({ type: "TEXT", content: "hello 😀" });
    });

    expect(sendMessage).toHaveBeenCalledWith("c1", { type: "TEXT", content: "hello 😀" });
  });

  it("reports a refused sticker without changing the history", async () => {
    const { result } = await openThread();
    sendMessage.mockRejectedValueOnce(new Error("INVALID_STICKER"));

    let outcome: Awaited<ReturnType<typeof result.current.send>> | undefined;
    await act(async () => {
      outcome = await result.current.send({ type: "STICKER", stickerId: "nope" });
    });

    expect(outcome?.ok).toBe(false);
    expect(result.current.messages).toHaveLength(3);
  });

  it("takes a sticker frame with no content, and once even when REST and the socket both deliver it", async () => {
    const { result } = await openThread();
    const sticker = stickerMessage(4);

    act(() => topic.handler?.(JSON.stringify(sticker)));
    sendMessage.mockResolvedValueOnce(sticker);
    await act(async () => {
      await result.current.send({ type: "STICKER", stickerId: "fire" });
    });
    act(() => topic.handler?.(JSON.stringify(sticker)));

    expect(result.current.messages.filter((m) => m.id === "4")).toHaveLength(1);
    expect(result.current.messages.at(-1)?.sticker?.name).toBe("Fire");
  });

  it("finds a sticker missed while offline when the network returns", async () => {
    const { result } = await openThread();
    listMessages.mockResolvedValueOnce({ items: [stickerMessage(4), msg(3), msg(2), msg(1)], nextCursor: null, hasMore: false });

    act(() => {
      window.dispatchEvent(new Event("online"));
    });
    await flush();

    expect(result.current.messages.at(-1)?.type).toBe("STICKER");
  });
});

describe("useChatThread reactions, replies, recall and delete", () => {
  const event = (body: Record<string, unknown>) => JSON.stringify({ conversationId: "c1", ...body });
  const update = (messageId: string, over: Record<string, unknown> = {}) =>
    event({ type: "MESSAGE_UPDATED", update: { messageId, conversationId: "c1", revision: 1, recalledAt: null, reactions: [], ...over } });

  it("takes a reply from the viewer's own queue, once even if the topic delivers it too", async () => {
    const { result } = await openThread();
    const reply = { ...msg(4), replyToMessageId: "2", replyTo: { messageId: "2", state: "OK", senderId: "2", type: "TEXT", content: "m2", sticker: null } };

    act(() => queue.handler?.(event({ type: "MESSAGE", message: reply })));
    act(() => topic.handler?.(frame(reply as MessageResponse)));

    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "2", "3", "4"]);
    expect(result.current.messages.at(-1)?.replyTo?.messageId).toBe("2");
  });

  it("applies a reaction update, and a recall wipes the text; neither is an unread message", async () => {
    const { result } = await openThread();
    markConversationRead.mockClear();

    act(() => queue.handler?.(update("2", { reactions: [{ userId: 1, emoji: "\u{1F44D}" }] })));
    expect(result.current.messages[1].reactions).toEqual([{ userId: "1", emoji: "\u{1F44D}" }]);

    act(() => queue.handler?.(update("2", { revision: 2, recalledAt: "2026-10-27T09:00:00Z" })));
    expect(result.current.messages[1]).toMatchObject({ content: null, reactions: [], recalledAt: "2026-10-27T09:00:00Z" });
    expect(result.current.messages).toHaveLength(3);
    expect(markConversationRead).not.toHaveBeenCalled();
  });

  it("does not let a page fetched before the recall bring the text back", async () => {
    const { result } = await openThread();
    act(() => queue.handler?.(update("2", { revision: 2, recalledAt: "2026-10-27T09:00:00Z" })));

    listMessages.mockResolvedValueOnce(page([1, 2, 3]));
    act(() => void window.dispatchEvent(new Event("focus")));
    await flush();

    expect(result.current.messages[1].content).toBeNull();
  });

  it("ignores updates and deletes meant for another conversation", async () => {
    const { result } = await openThread();
    act(() => queue.handler?.(JSON.stringify({ type: "MESSAGE_HIDDEN", conversationId: "other", messageId: "2" })));
    expect(result.current.messages).toHaveLength(3);
  });

  it("removes a message deleted from this side in another tab, and a stale page does not restore it", async () => {
    const { result } = await openThread();
    act(() => queue.handler?.(event({ type: "MESSAGE_HIDDEN", messageId: "2" })));
    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "3"]);

    listMessages.mockResolvedValueOnce(page([1, 2, 3]));
    act(() => void window.dispatchEvent(new Event("focus")));
    await flush();

    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("a refetch drops a message the server no longer returns inside the window it covers", async () => {
    const { result } = await openThread();
    listMessages.mockResolvedValueOnce({ items: [msg(3), msg(1)], nextCursor: null, hasMore: false });

    act(() => void window.dispatchEvent(new Event("focus")));
    await flush();

    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("reacting with a new emoji sets it; with its own current one takes it back", async () => {
    const { result } = await openThread();
    reactToMessage.mockResolvedValue({ messageId: "2", conversationId: "c1", revision: 1, recalledAt: null, reactions: [{ userId: "1", emoji: "\u{1F44D}" }] });
    removeReaction.mockResolvedValue({ messageId: "2", conversationId: "c1", revision: 2, recalledAt: null, reactions: [] });

    await act(async () => void (await result.current.react("2", "\u{1F44D}")));
    expect(reactToMessage).toHaveBeenCalledWith("c1", "2", "\u{1F44D}");
    expect(result.current.messages[1].reactions).toHaveLength(1);

    await act(async () => void (await result.current.react("2", "\u{1F44D}")));
    expect(removeReaction).toHaveBeenCalledWith("c1", "2");
    expect(result.current.messages[1].reactions).toHaveLength(0);
  });

  it("hide removes it here only after the server confirmed; a failure changes nothing", async () => {
    const { result } = await openThread();
    hideMessage.mockRejectedValueOnce(new Error("offline"));
    let outcome: { ok: boolean } | undefined;
    await act(async () => void (outcome = await result.current.hide("2")));
    expect(outcome?.ok).toBe(false);
    expect(result.current.messages).toHaveLength(3);

    hideMessage.mockResolvedValueOnce(null);
    await act(async () => void (await result.current.hide("2")));
    expect(result.current.messages.map((m) => m.id)).toEqual(["1", "3"]);
  });

  it("recall applies the server's answer", async () => {
    const { result } = await openThread();
    recallMessage.mockResolvedValue({ messageId: "3", conversationId: "c1", revision: 1, recalledAt: "2026-10-27T09:00:00Z", reactions: [] });

    await act(async () => void (await result.current.recall("3")));

    expect(result.current.messages[2].recalledAt).toBe("2026-10-27T09:00:00Z");
  });
});
