import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ConversationResponse } from "@/lib/api/conversations";
import { clearDraft, resetDraftsForTest, saveDraft } from "@/lib/chat-drafts";

vi.mock("@/components/messages/ChatUnreadProvider", () => ({ useChatUnreadContext: () => ({ nowMs: 0 }) }));
vi.mock("@/components/messages/MessagesLink", () => ({
  MessagesLink: ({ children, href }: { children: React.ReactNode; href: string }) => <a href={href}>{children}</a>,
}));
vi.mock("@/components/messages/ConversationMenu", () => ({ ConversationMenu: () => null }));
vi.mock("@/components/messages/ChatAvatar", () => ({ ChatAvatar: () => null }));
vi.mock("@/hooks/use-hover-capable", () => ({ useHoverCapable: () => true }));
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: { userId: "1" } }) }));

import { ConversationRow } from "@/components/messages/ConversationList";

const item: ConversationResponse = {
  id: "A",
  participantIds: ["1", "2"],
  lastMessageContent: "see you",
  lastMessageType: "TEXT",
  lastMessageSenderId: "2",
  lastMessageAt: "2026-10-27T08:00:00.000Z",
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
  blockedByViewer: null,
  messagingBlocked: null,
  blockVersion: 0,
};

const row = (me = "1") => render(<ConversationRow item={item} author={undefined} me={me} active={false} />);

beforeEach(() => {
  window.localStorage.clear();
  resetDraftsForTest();
});
afterEach(cleanup);

describe("ConversationRow draft preview", () => {
  it("shows the latest message when there is no draft", () => {
    row();
    expect(screen.queryByText("Draft:", { exact: false })).toBeNull();
    expect(screen.getByText("see you")).toBeTruthy();
  });

  it("shows 'Draft:' and the text in place of the last message, and reacts live", () => {
    row();
    act(() => saveDraft("1", "A", "abc"));
    expect(screen.getByText("Draft:", { exact: false })).toBeTruthy();
    expect(screen.getByText("abc", { exact: false })).toBeTruthy();
    expect(screen.queryByText("see you")).toBeNull();

    act(() => clearDraft("1", "A"));
    expect(screen.queryByText("Draft:", { exact: false })).toBeNull();
    expect(screen.getByText("see you")).toBeTruthy();
  });

  it("keeps the unread mark: a draft is not a read message", () => {
    row();
    act(() => saveDraft("1", "A", "abc"));
    expect(screen.getByRole("img", { name: "Unread" })).toBeTruthy();
  });

  it("flattens a multi-line draft onto one truncating line", () => {
    row();
    act(() => saveDraft("1", "A", "line one\n\nline two"));
    expect(screen.getByText("line one line two", { exact: false }).className).toContain("truncate");
  });

  it("does not show another account's draft", () => {
    saveDraft("9", "A", "secret");
    row("1");
    expect(screen.queryByText("secret", { exact: false })).toBeNull();
  });
});
