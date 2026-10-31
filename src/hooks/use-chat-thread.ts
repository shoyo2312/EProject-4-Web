"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  acknowledgeRead,
  getReceipts,
  hideMessage,
  listMessages,
  parseChatEvent,
  parseMessageFrame,
  reactToMessage,
  recallMessage,
  removeReaction,
  sendMessage,
  type MessageResponse,
  type MessageUpdate,
  type Receipt,
  type SendPayload,
} from "@/lib/api/conversations";
import {
  applyUpdate,
  comparePosition,
  mergeMessages,
  mergeReceipt,
  myReaction,
  reconcileWindow,
  removeMessage,
} from "@/lib/chat";
import { isWindowActive } from "@/lib/chat-viewing";
import { onStompConnect, onStompDisconnect, subscribeTopic } from "@/lib/realtime/stompClient";
import { TYPING_PEER_TTL_MS } from "@/lib/typing";

export type ThreadStatus = "loading" | "ready" | "error";

export type SendResult = { ok: true; message: MessageResponse } | { ok: false; error: unknown };

export type ActionResult = { ok: true } | { ok: false; error: unknown };

/** A read acknowledgement that fails is tried again this many times, this long after the last attempt. */
const READ_RETRIES = 3;
const READ_RETRY_MS = 3_000;

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
  /** How far the other participant has got: what "Delivered" and "Seen" are read from. Null until known. */
  receipt?: Receipt | null;
  /** The other participant is typing here right now; false the moment they stop, send, or the dots time out. */
  peerTyping?: boolean;
  /** Messages that arrived live (a frame, or the viewer's own send) while this thread was open — the only ones that animate in. */
  liveIds?: ReadonlySet<string>;
  /**
   * `messageId`, a message of the other side, is on screen in a thread being looked at: tells the
   * server so, once per position, and retries a failure. A no-op while the tab is hidden or unfocused.
   */
  markSeen: (messageId: string) => void;
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
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [peerTyping, setPeerTyping] = useState(false);
  const [liveIds, setLiveIds] = useState<ReadonlySet<string>>(() => new Set());
  const markLive = useCallback((id: string) => setLiveIds((current) => (current.has(id) ? current : new Set(current).add(id))), []);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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
   * Read means seen: the message is in the thread's scroll area, in view, in a tab that is shown and a
   * window that has focus — decided by the list after it has rendered, and handed here by id. Opening
   * the thread, loading its history or a frame arriving prove nothing of the kind. The server moves the
   * read mark to that message's position; messages after it stay unread.
   *
   * `acknowledged` is the furthest position already sent (or on its way), so scrolling about does not
   * repeat it; a failure puts it back and tries again a little later, the same position each time.
   */
  const acknowledged = useRef<{ sentAt: string; messageId: string } | null>(null);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const seenImpl = useRef<(messageId: string, attempt: number) => void>(() => {});
  useEffect(() => {
    seenImpl.current = (messageId, attempt) => {
      if (!isWindowActive()) return;
      const message = messagesRef.current.find((m) => m.id === messageId);
      if (!message || message.senderId === me) return;
      const position = { sentAt: message.sentAt, messageId };
      const before = acknowledged.current;
      if (before && comparePosition(position, before) <= 0) return;
      acknowledged.current = position;
      acknowledgeRead(conversationId, messageId).then(
        () => onReadRef.current(conversationId, message.sentAt),
        () => {
          if (acknowledged.current !== position) return;
          acknowledged.current = before;
          if (attempt < READ_RETRIES) {
            retryTimer.current = setTimeout(() => seenImpl.current(messageId, attempt + 1), READ_RETRY_MS);
          }
        },
      );
    };
  }, [conversationId, me]);
  const markSeen = useCallback((messageId: string) => seenImpl.current(messageId, 0), []);

  useEffect(() => {
    const controller = new AbortController();
    cursor.current = null;
    olderInFlight.current = false;
    hidden.current = new Set();
    acknowledged.current = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a new thread starts from an empty list, not the previous one's
    setMessages([]);
    setReceipt(null);
    setPeerTyping(false);
    setLiveIds(new Set());
    setHasMore(false);
    setLoadingOlder(false);
    setStatus("loading");

    getReceipts(conversationId, controller.signal).then(
      (answer) => setReceipt((current) => mergeReceipt(current, answer)),
      () => {
        // No state shown beyond "Sent"; the next frame or resync fills it in.
      },
    );
    listMessages(conversationId, null, controller.signal).then(
      (page) => {
        cursor.current = page.nextCursor;
        setMessages(mergeMessages([], page.items));
        setHasMore(page.hasMore);
        setStatus("ready");
      },
      () => {
        if (!controller.signal.aborted) setStatus("error");
      },
    );
    return () => {
      controller.abort();
      if (retryTimer.current) clearTimeout(retryTimer.current);
    };
  }, [conversationId, attempt]);

  useEffect(() => {
    const refetchNewest = () => {
      if (document.visibilityState !== "visible") return;
      const size = Math.min(RESYNC_MAX, Math.max(RESYNC_MIN, messagesRef.current.length));
      getReceipts(conversationId).then(
        (answer) => setReceipt((current) => mergeReceipt(current, answer)),
        () => {},
      );
      listMessages(conversationId, null, undefined, size).then(
        (page) => {
          const items = page.items.filter((message) => !hidden.current.has(message.id));
          // Also what changed on messages already shown — reactions, recalls, deletes made elsewhere.
          setMessages((current) => reconcileWindow(current, items, !page.hasMore));
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
  }, [conversationId]);

  /** A typing frame that stops arriving must not leave the dots up: they expire on their own. */
  const showPeerTyping = useCallback((on: boolean) => {
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = null;
    setPeerTyping(on);
    if (on) typingTimer.current = setTimeout(() => setPeerTyping(false), TYPING_PEER_TTL_MS);
  }, []);

  useEffect(() => {
    // The socket dropping means whatever was said about typing can no longer be trusted.
    const stop = onStompDisconnect(() => showPeerTyping(false));
    return () => {
      stop();
      if (typingTimer.current) clearTimeout(typingTimer.current);
    };
  }, [conversationId, showPeerTyping]);

  useEffect(
    () =>
      subscribeTopic(`/topic/conversations/${conversationId}`, (body) => {
        // Parsed with ids kept exact: `senderId` is an 18-digit number and `me` is compared as a string.
        const message = parseMessageFrame(body);
        if (!message) return;
        setMessages((current) => mergeIn(current, [message]));
        markLive(message.id);
        // They sent it, so they are not typing it any more.
        if (message.senderId !== me) showPeerTyping(false);
      }),
    [conversationId, me, mergeIn, showPeerTyping, markLive],
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
          markLive(event.message.id);
          if (event.message.senderId !== me) showPeerTyping(false);
        } else if (event.type === "MESSAGE_UPDATED") {
          setMessages((current) => applyUpdate(current, event.update));
        } else if (event.type === "RECEIPT") {
          if (event.receipt.userId !== me) setReceipt((current) => mergeReceipt(current, event.receipt));
        } else if (event.type === "TYPING") {
          if (event.userId !== me) showPeerTyping(event.typing);
        } else if (event.type === "MESSAGE_HIDDEN") {
          hidden.current.add(event.messageId);
          setMessages((current) => removeMessage(current, event.messageId));
        }
      }),
    [conversationId, me, mergeIn, showPeerTyping, markLive],
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
        markLive(sent.id);
        return { ok: true, message: sent };
      } catch (error) {
        return { ok: false, error };
      }
    },
    [conversationId, mergeIn, markLive],
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

  return {
    messages,
    status,
    hasMore,
    loadingOlder,
    loadOlder,
    retry,
    receipt,
    peerTyping,
    liveIds,
    markSeen,
    send,
    react,
    recall,
    hide,
  };
}
