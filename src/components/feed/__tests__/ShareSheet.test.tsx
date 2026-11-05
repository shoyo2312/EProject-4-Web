import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";

const { chat, api } = vi.hoisted(() => ({
  chat: {
    conversations: [] as ConversationResponse[],
    authors: new Map<string, unknown>(),
    status: "ready" as "loading" | "ready" | "error",
    reload: vi.fn(),
  },
  api: {
    openConversation: vi.fn(),
    sendMessage: vi.fn(),
    shareVideo: vi.fn(),
    searchUsers: vi.fn(),
  },
}));

vi.mock("@/components/messages/ChatUnreadProvider", () => ({ useChatUnreadContext: () => chat }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" }, openLogin: vi.fn() }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element
  default: ({ src, alt }: { src: string; alt: string }) => <img src={src} alt={alt} />,
}));
vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  openConversation: (...a: unknown[]) => api.openConversation(...a),
  sendMessage: (...a: unknown[]) => api.sendMessage(...a),
}));
vi.mock("@/lib/api/interactions", () => ({
  repostVideo: vi.fn(),
  shareVideo: (...a: unknown[]) => api.shareVideo(...a),
}));
vi.mock("@/lib/api/users", () => ({ searchUsers: (...a: unknown[]) => api.searchUsers(...a) }));

import { ShareSheet } from "@/components/feed/ShareSheet";

const convo = (id: string, other: string, minute: number, over: Partial<ConversationResponse> = {}): ConversationResponse => ({
  id,
  participantIds: ["1", other],
  lastMessageContent: "x",
  lastMessageType: "TEXT",
  lastMessageSenderId: other,
  lastMessageAt: new Date(Date.UTC(2026, 9, 28, 8, minute)).toISOString(),
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

const setChat = (list: ConversationResponse[]) => {
  chat.conversations = list;
  chat.authors = new Map(
    list.map((c) => {
      const other = c.participantIds[1];
      return [other, { userId: other, username: other, nickname: `Person ${other}`, avatarUrl: "/a.png" }];
    }),
  );
};

const renderSheet = (over: { onClose?: () => void; onShared?: (n: number) => void } = {}) =>
  render(<ShareSheet videoId="v1" shares={3} onClose={over.onClose ?? vi.fn()} onShared={over.onShared} />);

const tile = (name: string) => screen.getByRole("checkbox", { name });

beforeEach(() => {
  chat.status = "ready";
  setChat([convo("pinned-old", "10", 1, { pinnedAt: "2026-10-28T09:00:00.000Z" }), convo("new", "11", 30), convo("mid", "12", 20)]);
  api.openConversation.mockReset().mockImplementation(async (userId: string) => convo(`c${userId}`, userId, 1));
  api.sendMessage.mockReset().mockImplementation(
    async (conversationId: string) => ({ id: `m-${conversationId}`, conversationId, senderId: "1" }) as MessageResponse,
  );
  api.shareVideo.mockReset().mockResolvedValue({});
  api.searchUsers.mockReset();
});
afterEach(cleanup);

describe("ShareSheet recipients", () => {
  it("lists recent chats by the newest message, not by pin", () => {
    renderSheet();
    expect(screen.getAllByRole("checkbox").map((c) => c.getAttribute("aria-label"))).toEqual([
      "Person 11",
      "Person 12",
      "Person 10",
    ]);
  });

  it("draws an avatar from any host, such as a seeded account's, without next/image's allow-list", () => {
    setChat([convo("a", "10", 5)]);
    chat.authors = new Map([["10", { userId: "10", username: "10", nickname: "Person 10", avatarUrl: "https://i.pravatar.cc/150?img=12" }]]);
    const { container } = renderSheet();
    expect(container.ownerDocument.querySelector('img[src="https://i.pravatar.cc/150?img=12"]')).toBeTruthy();
  });

  it("says when the chats are loading, failed or empty, and retries", () => {
    chat.status = "loading";
    setChat([]);
    const view = renderSheet();
    expect(screen.queryAllByRole("checkbox")).toHaveLength(0);

    chat.status = "error";
    view.rerender(<ShareSheet videoId="v1" shares={3} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(chat.reload).toHaveBeenCalled();

    chat.status = "ready";
    view.rerender(<ShareSheet videoId="v1" shares={3} onClose={vi.fn()} />);
    expect(screen.getByText(/No recent chats/)).toBeTruthy();
  });

  it("keeps the picks while the search changes the row", async () => {
    renderSheet();
    fireEvent.click(tile("Person 11"));
    api.searchUsers.mockResolvedValue({
      content: [{ userId: "50", username: "zed", displayName: "Zed", avatarUrl: null }],
    });
    fireEvent.click(screen.getByRole("button", { name: "Search people" }));
    fireEvent.change(screen.getByPlaceholderText("Search people"), { target: { value: "ze" } });
    await waitFor(() => expect(screen.getByRole("checkbox", { name: "Zed" })).toBeTruthy(), { timeout: 2000 });
    fireEvent.click(tile("Zed"));
    expect(screen.getByRole("button", { name: "Send (2)" })).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close search" }));
    expect(tile("Person 11").getAttribute("aria-checked")).toBe("true");
    expect(screen.getByRole("button", { name: "Send (2)" })).toBeTruthy();
  });
});

describe("ShareSheet sending", () => {
  it("creates nothing until Send is pressed, and shows the count on the button", () => {
    renderSheet();
    fireEvent.click(tile("Person 11"));
    fireEvent.click(tile("Person 12"));
    expect(screen.getByRole("button", { name: "Send (2)" })).toBeTruthy();
    expect(screen.getByPlaceholderText("Write a message…")).toBeTruthy();
    expect(api.openConversation).not.toHaveBeenCalled();
    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(api.shareVideo).not.toHaveBeenCalled();

    fireEvent.click(tile("Person 11"));
    fireEvent.click(tile("Person 12"));
    expect(screen.queryByPlaceholderText("Write a message…")).toBeNull();
    expect(screen.getByText("Copy")).toBeTruthy();
  });

  it("sends one VIDEO message per person with the note, reports the delivered count, and closes", async () => {
    const onClose = vi.fn();
    const onShared = vi.fn();
    renderSheet({ onClose, onShared });
    fireEvent.click(tile("Person 11"));
    fireEvent.click(tile("Person 12"));
    fireEvent.change(screen.getByPlaceholderText("Write a message…"), { target: { value: "look" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send (2)" })));

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.sendMessage).toHaveBeenCalledTimes(2);
    expect(api.sendMessage.mock.calls[0][1]).toMatchObject({ type: "VIDEO", videoId: "v1", content: "look" });
    expect(onShared).toHaveBeenCalledWith(2);
    // Chat sends are counted by the server; the sheet never calls the share endpoint for them.
    expect(api.shareVideo).not.toHaveBeenCalled();
  });

  it("a double press sends once", async () => {
    renderSheet();
    fireEvent.click(tile("Person 11"));
    const send = screen.getByRole("button", { name: "Send (1)" });
    await act(async () => {
      fireEvent.click(send);
      fireEvent.click(send);
    });
    await waitFor(() => expect(api.sendMessage).toHaveBeenCalledTimes(1));
  });

  it("keeps the failed person to retry, never resends the delivered one, and keeps the key", async () => {
    const onClose = vi.fn();
    api.sendMessage.mockImplementation(async (conversationId: string) => {
      if (conversationId === "c12") throw new ApiError(403, "MESSAGING_BLOCKED", "x");
      return { id: `m-${conversationId}`, conversationId, senderId: "1" } as MessageResponse;
    });
    renderSheet({ onClose });
    fireEvent.click(tile("Person 11"));
    fireEvent.click(tile("Person 12"));
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send (2)" })));

    await waitFor(() => expect(screen.getByRole("alert").textContent).toMatch(/Person 12.*can.t message/i));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Retry (1)" })).toBeTruthy();
    const firstKey = api.sendMessage.mock.calls.find((c) => c[0] === "c12")?.[1].clientRequestId;

    api.sendMessage.mockImplementation(
      async (conversationId: string) => ({ id: `m-${conversationId}`, conversationId, senderId: "1" }) as MessageResponse,
    );
    api.sendMessage.mockClear();
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry (1)" })));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(api.sendMessage).toHaveBeenCalledTimes(1);
    expect(api.sendMessage.mock.calls[0][0]).toBe("c12");
    expect(api.sendMessage.mock.calls[0][1].clientRequestId).toBe(firstKey);
  });

  it("asks before reopening a deleted request, names who, and Cancel sends nothing and keeps the picks", async () => {
    api.openConversation.mockImplementation(async (userId: string) =>
      convo(`c${userId}`, userId, 1, userId === "12" ? { sendPermission: "REOPEN_ON_SEND" } : {}),
    );
    renderSheet();
    fireEvent.click(tile("Person 11"));
    fireEvent.click(tile("Person 12"));
    fireEvent.change(screen.getByPlaceholderText("Write a message…"), { target: { value: "keep me" } });
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Send (2)" })));

    const question = await screen.findByRole("alertdialog");
    expect(question.textContent).toContain("Person 12");
    expect(question.textContent).not.toContain("Person 11");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));

    expect(api.sendMessage).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Send (2)" })).toBeTruthy();
    expect((screen.getByPlaceholderText("Write a message…") as HTMLTextAreaElement).value).toBe("keep me");
  });
});

describe("ShareSheet counting", () => {
  it("counts a copied link as one share and opening or ticking as none", async () => {
    Object.assign(navigator, { clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } });
    const onShared = vi.fn();
    renderSheet({ onShared });
    expect(api.shareVideo).not.toHaveBeenCalled();
    await act(async () => fireEvent.click(screen.getByText("Copy")));
    await waitFor(() => expect(api.shareVideo).toHaveBeenCalledWith("v1"));
    await waitFor(() => expect(onShared).toHaveBeenCalledWith(1));
  });
});
