"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  hideMessage,
  listMessages,
  markConversationRead,
  parseChatEvent,
  parseMessageFrame,
  reactToMessage,
  recallMessage,
  removeReaction,
  sendMessage,
  type MessageResponse,
  type MessageUpdate,
  type SendPayload,
} from "@/lib/api/conversations";
import { applyUpdate, mergeMessages, myReaction, reconcileWindow, removeMessage } from "@/lib/chat";
import { isViewing } from "@/lib/chat-viewing";
import { onStompConnect, subscribeTopic } from "@/lib/realtime/stompClient";

export type ThreadStatus = "loading" | "ready" | "error";

export type SendResult = { ok: true; message: MessageResponse } | { ok: false; error: unknown };

export type ActionResult = { ok: true } | { ok: false; error: unknown };

/** The newest page is refetched this large (at most) to catch changes to messages already on screen. */
const RESYNC_MIN = 30;
const RESYNC_MAX = 100;

export interface ChatThread {
  /** Oldest first. */
  messages: MessageResponse[];
  status: ThreadStatus;
  hasMore: boolean;
  loadingOlder: boolean;
  loadOlder: () => void;
  retry: () => void;
  /** Tells the server this thread is read — a no-op unless it is being looked at. */
  markRead: () => void;
  send: (payload: SendPayload) => Promise<SendResult>;
  /** Sets, changes or — when it is the viewer's current one — takes back a reaction. */
  react: (messageId: string, emoji: string) => Promise<ActionResult>;
  /** For everyone; the sender only. */
  recall: (messageId: string) => Promise<ActionResult>;
  /** From the viewer's own side only. */
  hide: (messageId: string) => Promise<ActionResult>;
}

/**
 * One open conversation: newest page first, older pages on demand, live frames merged in, and
 * the thread marked read while it is on screen.
 *
 * The broker does not replay, so anything sent while the socket was down is missing until the
 * newest page is fetched again — which happens when the tab is shown or the network returns.
 */
export function useChatThread(
  conversationId: string,
  me: string,
  onRead: (conversationId: string, readAt: string) => void,
): ChatThread {
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [status, setStatus] = useState<ThreadStatus>("loading");
  const [hasMore, setHasMore] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const cursor = useRef<string | null>(null);
  const olderInFlight = useRef(false);

  const onReadRef = useRef(onRead);
  useEffect(() => {
    onReadRef.current = onRead;
  });

  const messagesRef = useRef(messages);
  /** Deleted from this side: a page that was already in flight must not bring them back. */
  const hidden = useRef(new Set<string>());
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  const mergeIn = useCallback(
    (current: MessageResponse[], incoming: readonly MessageResponse[]) =>
      mergeMessages(current, incoming.filter((message) => !hidden.current.has(message.id))),
    [],
  );

  const newestSentAt = useRef<string | null>(null);
  useEffect(() => {
    newestSentAt.current = messages.length > 0 ? messages[messages.length - 1].sentAt : null;
  }, [messages]);

  /**
   * Read means seen: the thread is on screen with its newest message in view, the tab is shown
   * and the window focused (see `chat-viewing`). A thread in a background tab, a minimised panel
   * or scrolled up keeps collecting unread messages until the viewer is back at the bottom.
   */
  const markRead = useCallback(() => {
    if (!isViewing(conversationId)) return;
    markConversationRead(conversationId).then(
      () => onReadRef.current(conversationId, newestSentAt.current ?? new Date().toISOString()),
      () => {
        // The dot stays; the next message or visit tries again.
      },
    );
  }, [conversationId]);

  useEffect(() => {
    const controller = new AbortController();
    cursor.current = null;
    olderInFlight.current = false;
    hidden.current = new Set();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new thread starts from an empty list, not the previous one's
    setMessages([]);
    setHasMore(false);
    setLoadingOlder(false);
    setStatus("loading");

    listMessages(conversationId, null, controller.signal).then(
      (page) => {
        cursor.current = page.nextCursor;
        setMessages(mergeMessages([], page.items));
        setHasMore(page.hasMore);
        setStatus("ready");
        markRead();
      },
      () => {
        if (!controller.signal.aborted) setStatus("error");
      },
    );
    return () => controller.abort();
  }, [conversationId, attempt, markRead]);

  useEffect(() => {
    const refetchNewest = () => {
      if (document.visibilityState !== "visible") return;
      const size = Math.min(RESYNC_MAX, Math.max(RESYNC_MIN, messagesRef.current.length));
      listMessages(conversationId, null, undefined, size).then(
        (page) => {
          const items = page.items.filter((message) => !hidden.current.has(message.id));
          // Also what changed on messages already shown — reactions, recalls, deletes made elsewhere.
          setMessages((current) => reconcileWindow(current, items, !page.hasMore));
          markRead();
        },
        () => {
          // Offline still; the next event retries.
        },
      );
    };
    document.addEventListener("visibilitychange", refetchNewest);
    window.addEventListener("online", refetchNewest);
    window.addEventListener("focus", refetchNewest);
    // The broker keeps no history: whatever happened while the socket was down is read back here.
    const stopReconnect = onStompConnect(refetchNewest);
    return () => {
      stopReconnect();
      document.removeEventListener("visibilitychange", refetchNewest);
      window.removeEventListener("online", refetchNewest);
      window.removeEventListener("focus", refetchNewest);
    };
  }, [conversationId, markRead]);

  useEffect(
    () =>
      subscribeTopic(`/topic/conversations/${conversationId}`, (body) => {
        // Parsed with ids kept exact: `senderId` is an 18-digit number and `me` is compared as a string.
        const message = parseMessageFrame(body);
        if (!message) return;
        setMessages((current) => mergeIn(current, [message]));
        if (message.senderId !== me) markRead();
      }),
    [conversationId, me, markRead, mergeIn],
  );

  /**
   * The viewer's own queue: replies (rendered per viewer, so never on the shared topic), reaction
   * and recall updates, and this viewer's deletes from another tab. None of it counts as unread —
   * the inbox hook owns that, and it ignores everything but new messages.
   */
  useEffect(
    () =>
      subscribeTopic("/user/queue/chat", (body) => {
        const event = parseChatEvent(body);
        if (!event || event.conversationId !== conversationId) return;
        if (event.type === "MESSAGE") {
          setMessages((current) => mergeIn(current, [event.message]));
          if (event.message.senderId !== me) markRead();
        } else if (event.type === "MESSAGE_UPDATED") {
          setMessages((current) => applyUpdate(current, event.update));
        } else if (event.type === "MESSAGE_HIDDEN") {
          hidden.current.add(event.messageId);
          setMessages((current) => removeMessage(current, event.messageId));
        }
      }),
    [conversationId, me, markRead, mergeIn],
  );

  const loadOlder = useCallback(() => {
    if (olderInFlight.current || !cursor.current) return;
    olderInFlight.current = true;
    setLoadingOlder(true);
    listMessages(conversationId, cursor.current).then(
      (page) => {
        cursor.current = page.nextCursor;
        setMessages((current) => mergeIn(current, page.items));
        setHasMore(page.hasMore);
      },
      () => {
        // The cursor is untouched, so scrolling to the top again retries.
      },
    ).finally(() => {
      olderInFlight.current = false;
      setLoadingOlder(false);
    });
  }, [conversationId, mergeIn]);

  const send = useCallback(
    async (payload: SendPayload): Promise<SendResult> => {
      try {
        const sent = await sendMessage(conversationId, payload);
        setMessages((current) => mergeIn(current, [sent]));
        return { ok: true, message: sent };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [conversationId, mergeIn],
  );

  /** What the server answered is applied the same way a pushed update is, so the two cannot disagree. */
  const settle = useCallback(async (request: Promise<MessageUpdate>): Promise<ActionResult> => {
    try {
      const update = await request;
      setMessages((current) => applyUpdate(current, update));
      return { ok: true };
    } catch (error) {
      return { ok: false, error };
    }
  }, []);

  const react = useCallback(
    (messageId: string, emoji: string) => {
      const held = messagesRef.current.find((message) => message.id === messageId);
      const taking = held !== undefined && myReaction(held, me) === emoji;
      return settle(
        taking ? removeReaction(conversationId, messageId) : reactToMessage(conversationId, messageId, emoji),
      );
    },
    [conversationId, me, settle],
  );

  const recall = useCallback(
    (messageId: string) => settle(recallMessage(conversationId, messageId)),
    [conversationId, settle],
  );

  const hide = useCallback(
    async (messageId: string): Promise<ActionResult> => {
      try {
        await hideMessage(conversationId, messageId);
        hidden.current.add(messageId);
        setMessages((current) => removeMessage(current, messageId));
        return { ok: true };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [conversationId],
  );

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  return { messages, status, hasMore, loadingOlder, loadOlder, retry, markRead, send, react, recall, hide };
}
