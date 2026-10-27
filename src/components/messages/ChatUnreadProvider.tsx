"use client";

import { createContext, useContext } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { useChatUnread, type ChatUnread } from "@/hooks/use-chat-unread";

const refused = () => Promise.reject(new Error("ChatUnreadProvider is not mounted"));

const NONE: ChatUnread = {
  total: 0,
  byConversation: {},
  conversations: [],
  requests: [],
  requestSummary: { pending: 0, unread: 0 },
  authors: new Map(),
  status: "loading",
  reload: () => {},
  markRead: () => {},
  applyConversation: () => {},
  acceptRequest: refused,
  declineRequest: refused,
  nowMs: 0,
  pin: refused,
  unpin: refused,
  mute: refused,
  unmute: refused,
  deleteConversation: refused,
  blocked: new Set(),
  markBlocked: () => {},
};

const ChatUnreadContext = createContext<ChatUnread>(NONE);

/**
 * The chat state for the whole app: the sidebar reads the Messages badge from it, the floating chat
 * draws its bubbles from it, `/messages` draws the inbox and the message-request box from it, and
 * an open thread reports what it has read. Lives in the root layout, so it keeps counting — and
 * keeps hearing new requests — on every page.
 */
export function ChatUnreadProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const value = useChatUnread(user?.userId ?? null);
  return <ChatUnreadContext.Provider value={value}>{children}</ChatUnreadContext.Provider>;
}

export function useChatUnreadContext(): ChatUnread {
  return useContext(ChatUnreadContext);
}
