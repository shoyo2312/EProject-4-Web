import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ChatThread } from "@/hooks/use-chat-thread";
import type { ConversationResponse, MessageResponse, StickerPack } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";
import { isViewing } from "@/lib/chat-viewing";

/*
 * The real MessageList is replaced by a stub that only reports "at the bottom" or not — its own
 * logic for deciding that is tested in MessageList.test.tsx. What is tested here is what ThreadBody
 * does with the report: the thread is only "viewed", and only marked read, at the bottom.
 */
const { list, listStickerPacks, applyConversation } = vi.hoisted(() => ({
  list: {
    report: null as ((atBottom: boolean) => void) | null,
    actions: null as {
      onReply: (message: MessageResponse) => void;
      onDelete: (message: MessageResponse) => void;
      onReact: (message: MessageResponse, emoji: string) => void;
    } | null,
  },
  listStickerPacks: vi.fn<() => Promise<StickerPack[]>>(),
  applyConversation: vi.fn(),
}));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listStickerPacks: () => listStickerPacks(),
}));
vi.mock("@/components/messages/ChatUnreadProvider", () => ({
  useChatUnreadContext: () => ({
    applyConversation,
    blocked: new Set<string>(),
    acceptRequest: vi.fn(),
    declineRequest: vi.fn(),
    requests: [],
    reload: vi.fn(),
  }),
}));

vi.mock("@/components/messages/thread/MessageList", () => ({
  MessageList: (props: {
    onAtBottomChange?: (atBottom: boolean) => void;
    onReply: (message: MessageResponse) => void;
    onDelete: (message: MessageResponse) => void;
    onReact: (message: MessageResponse, emoji: string) => void;
  }) => {
    list.report = props.onAtBottomChange ?? null;
    list.actions = props;
    return <div role="log" />;
  },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

import { ThreadBody } from "@/components/messages/thread/ThreadBody";
import { resetStickerPacksCache } from "@/hooks/use-sticker-packs";

const msg: MessageResponse = {
  id: "1",
  conversationId: "c1",
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

const conversation = (over: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id: "c1",
  participantIds: ["1", "2"],
  lastMessageContent: "hi",
  lastMessageType: "TEXT",
  lastMessageSenderId: "2",
  lastMessageAt: msg.sentAt,
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

const markRead = vi.fn();
const thread = (): ChatThread => ({
  messages: [msg],
  status: "ready",
  hasMore: false,
  loadingOlder: false,
  loadOlder: vi.fn(),
  retry: vi.fn(),
  markRead,
  send: vi.fn(),
  react: vi.fn(),
  recall: vi.fn(),
  hide: vi.fn(),
});

beforeEach(() => {
  markRead.mockReset();
  applyConversation.mockReset();
  list.report = null;
  vi.spyOn(document, "hasFocus").mockReturnValue(true);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const renderBody = (conv = conversation()) =>
  render(<ThreadBody conversation={conv} thread={thread()} me="1" name="Alice" avatar={undefined} />);

describe("ThreadBody reading state", () => {
  it("counts the thread as viewed and marks it read while the newest message is in view", () => {
    renderBody();
    expect(isViewing("c1")).toBe(true);
    expect(markRead).toHaveBeenCalled();
  });

  it("stops counting it as viewed as soon as the reader is above the newest message", () => {
    renderBody();
    markRead.mockClear();

    act(() => list.report?.(false));

    expect(isViewing("c1")).toBe(false);
    expect(markRead).not.toHaveBeenCalled();
  });

  it("marks read only once the reader really is back at the bottom", () => {
    renderBody();
    act(() => list.report?.(false));
    markRead.mockClear();

    // pressing the jump button, or a half-finished scroll, is not a report of arriving
    expect(markRead).not.toHaveBeenCalled();

    act(() => list.report?.(true));

    expect(isViewing("c1")).toBe(true);
    expect(markRead).toHaveBeenCalledTimes(1);
  });

  it("is not viewed once it is unmounted, so a closed or minimised panel keeps collecting unread", () => {
    const view = renderBody();
    view.unmount();
    expect(isViewing("c1")).toBe(false);
  });

  it("does not unlock a composer the server has locked for a message request", () => {
    renderBody(conversation({ requestState: "PENDING", initiatorId: "1", sendPermission: "REQUEST_SENT" }));
    act(() => list.report?.(false));
    act(() => list.report?.(true));

    expect(screen.queryByRole("textbox")).toBeNull();
    expect(screen.getByText("Chat request sent")).toBeTruthy();
  });
});

describe("ThreadBody stickers", () => {
  const stickerReply: MessageResponse = {
    ...msg,
    id: "9",
    senderId: "1",
    type: "STICKER",
    content: null,
    stickerId: "fire",
    sticker: { stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 },
  };

  function withSend(send: ChatThread["send"], conv: ConversationResponse) {
    return render(<ThreadBody conversation={conv} thread={{ ...thread(), send }} me="1" name="Alice" avatar={undefined} />);
  }

  async function pickSticker(name = "Fire") {
    fireEvent.click(screen.getByRole("button", { name: "Emoji and stickers" }));
    fireEvent.click(screen.getByRole("tab", { name: "Sticker" }));
    await act(async () => {});
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: `Send sticker: ${name}` }));
    });
  }

  beforeEach(() => {
    listStickerPacks.mockReset().mockResolvedValue([
      { packId: "fluent-3d", name: "Fluent 3D", stickers: [stickerReply.sticker!] },
    ]);
    resetStickerPacksCache();
  });

  it("sends a sticker as a STICKER payload by id", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: stickerReply });
    withSend(send, conversation());

    await pickSticker();

    expect(send).toHaveBeenCalledWith({ type: "STICKER", stickerId: "fire" });
  });

  it("shows why a sticker was refused and keeps the picker for another try", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: new ApiError(400, "INVALID_STICKER", "x") });
    withSend(send, conversation());

    await pickSticker();

    expect(screen.getByRole("alert").textContent).toMatch(/sticker isn't available/i);
    expect(screen.queryByRole("tablist")).not.toBeNull();
  });

  /** The first message of a request can be a sticker, and spends the round exactly as text does. */
  it("locks the composer after a sticker is the one message of a request", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: stickerReply });
    const conv = conversation({ requestState: "PENDING", initiatorId: "1", sendPermission: "FIRST_MESSAGE_ONLY" });
    withSend(send, conv);

    await pickSticker();

    expect(applyConversation).toHaveBeenCalledWith(
      expect.objectContaining({ sendPermission: "REQUEST_SENT", lastMessageType: "STICKER", lastMessageContent: null }),
    );
  });

  it("offers no picker at all while the request is waiting or needs an answer", () => {
    for (const permission of ["REQUEST_SENT", "AWAITING_ACCEPT"] as const) {
      const view = withSend(vi.fn(), conversation({ requestState: "PENDING", initiatorId: permission === "REQUEST_SENT" ? "1" : "2", sendPermission: permission }));
      expect(screen.queryByRole("button", { name: "Emoji and stickers" })).toBeNull();
      view.unmount();
    }
  });

  it("asks before a sticker reopens a request the viewer deleted, and sends nothing on Cancel", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: stickerReply });
    withSend(send, conversation({ requestState: "DECLINED", initiatorId: "2", sendPermission: "REOPEN_ON_SEND" }));

    await pickSticker();

    expect(screen.getByText(/message you again\?/)).toBeTruthy();
    expect(send).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    await act(async () => {});

    expect(send).not.toHaveBeenCalled();
    expect(screen.queryByText(/message you again\?/)).toBeNull();
  });

  it("sends the sticker once the viewer confirms the reopening", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: stickerReply });
    withSend(send, conversation({ requestState: "DECLINED", initiatorId: "2", sendPermission: "REOPEN_ON_SEND" }));

    await pickSticker();
    await act(async () => {
      fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Send message" }));
    });

    expect(send).toHaveBeenCalledWith({ type: "STICKER", stickerId: "fire" });
  });
});

describe("ThreadBody reply, delete and recall", () => {
  const mineMsg: MessageResponse = { ...msg, id: "5", senderId: "1", content: "from me" };

  function open(over: Partial<ChatThread> = {}) {
    const t = { ...thread(), messages: [msg, mineMsg], ...over };
    render(<ThreadBody conversation={conversation()} thread={t} me="1" name="Alice" avatar={undefined} />);
    return t;
  }

  const startReply = (target: MessageResponse) => act(() => list.actions?.onReply(target));
  const type = (text: string) => fireEvent.change(screen.getByRole("textbox"), { target: { value: text } });

  it("shows who and what is being answered over the composer", () => {
    open();
    startReply(msg);
    expect(screen.getByText("Alice:")).toBeTruthy();
    expect(screen.getByText("hi", { exact: false })).toBeTruthy();
    expect(screen.getByRole("textbox").getAttribute("placeholder")).toBe("Reply to message…");
  });

  it("drops the reply but keeps the draft when the cross is pressed", () => {
    open();
    startReply(msg);
    type("half written");
    fireEvent.click(screen.getByRole("button", { name: "Cancel reply" }));

    expect(screen.queryByText("Alice:")).toBeNull();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("half written");
  });

  it("sends the reply with the original's id, then leaves reply mode", async () => {
    const send = vi.fn().mockResolvedValue({ ok: true, message: { ...mineMsg, id: "6" } });
    open({ send });
    startReply(msg);
    type("answer");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    expect(send).toHaveBeenCalledWith({ type: "TEXT", content: "answer", replyToMessageId: "1" });
    expect(screen.queryByText("Alice:")).toBeNull();
  });

  it("keeps the reply and the text when the send fails", async () => {
    const send = vi.fn().mockResolvedValue({ ok: false, error: new ApiError(500, "X", "x") });
    open({ send });
    startReply(msg);
    type("answer");
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send message" }));
    });

    expect(screen.getByText("Alice:")).toBeTruthy();
    expect((screen.getByRole("textbox") as HTMLTextAreaElement).value).toBe("answer");
  });

  it("drops the reply when its target was recalled meanwhile", () => {
    const view = render(
      <ThreadBody conversation={conversation()} thread={{ ...thread(), messages: [msg] }} me="1" name="Alice" avatar={undefined} />,
    );
    startReply(msg);
    expect(screen.getByText("Alice:")).toBeTruthy();

    view.rerender(
      <ThreadBody
        conversation={conversation()}
        thread={{ ...thread(), messages: [{ ...msg, content: null, recalledAt: "2026-10-27T09:00:00Z" }] }}
        me="1"
        name="Alice"
        avatar={undefined}
      />,
    );
    expect(screen.queryByText("Alice:")).toBeNull();
  });

  it("offers recall only on the viewer's own message, and delete-for-you on both", () => {
    open();
    act(() => list.actions?.onDelete(msg));
    expect(screen.queryByRole("button", { name: /Recall for everyone/ })).toBeNull();
    expect(screen.getByRole("button", { name: /Delete for you/ })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

    act(() => list.actions?.onDelete(mineMsg));
    expect(screen.getByRole("button", { name: /Recall for everyone/ })).toBeTruthy();
  });

  it("delete-for-you calls hide, never recall", async () => {
    const hide = vi.fn().mockResolvedValue({ ok: true });
    const recall = vi.fn();
    open({ hide, recall });
    act(() => list.actions?.onDelete(mineMsg));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Delete for you/ }));
    });

    expect(hide).toHaveBeenCalledWith("5");
    expect(recall).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("recall calls recall, never hide, and a failure keeps the dialog and says why", async () => {
    const recall = vi.fn().mockResolvedValue({ ok: false, error: new ApiError(403, "NOT_MESSAGE_AUTHOR", "x") });
    const hide = vi.fn();
    open({ hide, recall });
    act(() => list.actions?.onDelete(mineMsg));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: /Recall for everyone/ }));
    });

    expect(recall).toHaveBeenCalledWith("5");
    expect(hide).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toMatch(/only the sender/i);
  });

  it("passes a reaction to the thread", async () => {
    const react = vi.fn().mockResolvedValue({ ok: true });
    open({ react });
    await act(async () => list.actions?.onReact(msg, "\u{1F44D}"));
    expect(react).toHaveBeenCalledWith("1", "\u{1F44D}");
  });
});
