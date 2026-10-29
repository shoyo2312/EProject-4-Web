"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { resolveAuthors } from "@/lib/api/authors";
import {
  acceptMessageRequest,
  acknowledgeDelivered,
  declineMessageRequest,
  deleteConversationForMe,
  getConversation,
  listConversations,
  listMessageRequests,
  listMessages,
  muteConversation,
  parseChatEvent,
  pinConversation,
  unmuteConversation,
  unpinConversation,
  type ChatEvent,
  type ConversationResponse,
  type MessageResponse,
  type MuteLength,
} from "@/lib/api/conversations";
import {
  applyIncoming,
  isMuted,
  keepNewerBlock,
  nextMuteExpiry,
  noticeBody,
  otherParticipantId,
  placeConversation,
  requestCounts,
  type InboxLists,
} from "@/lib/chat";
import { isViewing } from "@/lib/chat-viewing";
import { DeliveryAcker } from "@/lib/delivery-acker";
import {
  EMPTY_UNREAD,
  addUnread,
  dropConversation,
  loadUnread,
  markConversationReadLocally,
  needsTail,
  reconcile,
  saveUnread,
  unreadTotal,
  type UnreadState,
} from "@/lib/chat-unread";
import { isLastPage } from "@/lib/api/types";
import { getBlocked, setFollowRequested, setFollowState } from "@/lib/api/users";
import { onStompConnect, subscribeTopic } from "@/lib/realtime/stompClient";
import { showBrowserNotification } from "@/lib/settings/browser-notifications";
import type { Author } from "@/types/tiktok";

export type LoadStatus = "loading" | "ready" | "error";

export interface ChatUnread {
  /** Unread messages in the ordinary inbox. Message requests are not part of it. */
  total: number;
  /** Unread messages per ordinary conversation id; absent means none. */
  byConversation: Readonly<Record<string, number>>;
  /** Ordinary conversations plus requests the viewer opened, newest first, kept live. */
  conversations: readonly ConversationResponse[];
  /** Message requests waiting on the viewer, newest first. */
  requests: readonly ConversationResponse[];
  /**
   * `pending` is every request waiting on an answer; `unread` is the ones not opened yet. Two
   * different numbers, and neither counts messages — opening a request reads it, it does not accept it.
   */
  requestSummary: { pending: number; unread: number };
  /** The other participant of each conversation, keyed by their user id. */
  authors: ReadonlyMap<string, Author>;
  status: LoadStatus;
  reload: () => void;
  /** The thread was read up to `readAt` on this device; zeroes its share of the counts. */
  markRead: (conversationId: string, readAt: string) => void;
  /** Puts a conversation from the server into the right list — from a REST answer or a pushed event. */
  applyConversation: (conversation: ConversationResponse) => void;
  /** Recipient only. Resolves with the conversation as the server now has it. */
  acceptRequest: (conversationId: string) => Promise<ConversationResponse>;
  declineRequest: (conversationId: string) => Promise<ConversationResponse>;
  /**
   * The clock the mute state is read against; moves when a timed mute ends so what is drawn from it
   * (bell icons, the floating bubbles) updates without anyone touching the page.
   */
  nowMs: number;
  /** The viewer's own pin / mute / delete. Each resolves with the server's answer or rejects with its error. */
  pin: (conversationId: string) => Promise<ConversationResponse>;
  unpin: (conversationId: string) => Promise<ConversationResponse>;
  mute: (conversationId: string, length: MuteLength) => Promise<ConversationResponse>;
  unmute: (conversationId: string) => Promise<ConversationResponse>;
  /** From this account only; the other person keeps their copy. */
  deleteConversation: (conversationId: string) => Promise<void>;
  /**
   * The accounts the viewer has blocked, from the server and kept in step with their own block and
   * unblock. A conversation with one of them has no composer, only a way to unblock.
   */
  blockedUsers: ReadonlySet<string>;
  setBlockedUser: (userId: string, blocked: boolean) => void;
}

/** How often to look again, which also finds anything the socket missed. */
const RESYNC_MS = 30_000;
const TAIL_PAGE = 100;
/** How much of a conversation is read to hold what arrived while this client was away. */
const ACK_PAGE = 100;
const BLOCKED_PAGE = 100;
const BLOCKED_PAGES_MAX = 10;

/** Every account the viewer blocked, or null when the list cannot be read right now. */
async function loadBlockedUsers(): Promise<Set<string> | null> {
  const ids = new Set<string>();
  try {
    for (let page = 0; page < BLOCKED_PAGES_MAX; page += 1) {
      const answer = await getBlocked(page, BLOCKED_PAGE);
      for (const profile of answer.content) ids.add(String(profile.userId));
      if (isLastPage(answer.page)) break;
    }
  } catch {
    return null;
  }
  return ids;
}
const EMPTY_LISTS: InboxLists = { inbox: [], requests: [] };

/**
 * Everything the viewer's chat UI shares, for as long as the app is open on any page: the inbox,
 * the message-request box, the unread count and the people behind them. Two screens draw from it —
 * `/messages` and the floating chat — so a request that arrives, or is accepted in another tab,
 * changes both at once.
 *
 * Live: the viewer's own `/user/queue/chat` carries every new message and every change of a
 * conversation's state, including conversations the client has never heard of. Durable: the unread
 * state is saved per account, and a resync against REST (the server's word on what is unread and
 * what may be sent) runs on load, when the tab is shown, when the network returns, when the socket
 * reconnects and on a timer — the broker does not replay, so that is what repairs a gap.
 */
export function useChatUnread(me: string | null): ChatUnread {
  const [state, setState] = useState<UnreadState>(EMPTY_UNREAD);
  const [lists, setLists] = useState<InboxLists>(EMPTY_LISTS);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [authors, setAuthors] = useState<ReadonlyMap<string, Author>>(new Map());
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [blockedUsers, setBlockedUsers] = useState<ReadonlySet<string>>(new Set());
  /**
   * Counts the viewer's own changes (pin, mute, delete) as they start and finish. A resync that began
   * before one finished carries the old answer, so it is thrown away and asked again.
   */
  const mutationEpoch = useRef(0);
  const notified = useRef(new Set<string>());
  const authorsRef = useRef(authors);

  const stateRef = useRef(state);
  const listsRef = useRef(lists);
  const loadedFor = useRef<string | null>(null);
  useEffect(() => {
    stateRef.current = state;
    listsRef.current = lists;
    authorsRef.current = authors;
  });

  useEffect(() => {
    loadedFor.current = me;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the stored count belongs to the account that just signed in, and storage is not readable during render
    setState(me ? loadUnread(me) : EMPTY_UNREAD);
    if (!me) {
      setLists(EMPTY_LISTS);
      setStatus("loading");
    }
  }, [me]);

  useEffect(() => {
    if (me && loadedFor.current === me) saveUnread(me, state);
  }, [me, state]);

  /**
   * Tells the server which messages of the other side this client holds, so their sender can say
   * "received" — from the app, not from a thread: the person need not have opened anything. Belongs to
   * the signed-in account; replaced, with every pending timer and request cancelled, when it changes.
   */
  const acker = useRef<DeliveryAcker | null>(null);
  useEffect(() => {
    if (!me) return;
    const mine = new DeliveryAcker({
      me,
      acknowledge: acknowledgeDelivered,
      fetchNewest: async (conversationId) => (await listMessages(conversationId, null, undefined, ACK_PAGE)).items,
    });
    acker.current = mine;
    return () => {
      mine.dispose();
      if (acker.current === mine) acker.current = null;
    };
  }, [me]);

  const sync = useCallback(async () => {
    if (!me) return;
    const epoch = mutationEpoch.current;
    let rows: ConversationResponse[];
    let requests: ConversationResponse[] | null;
    let blockedNow: Set<string> | null;
    try {
      [rows, requests, blockedNow] = await Promise.all([
        listConversations(),
        // A box that cannot be read keeps what it had: the inbox is not held up by it.
        listMessageRequests().catch(() => null),
        loadBlockedUsers(),
      ]);
    } catch {
      setStatus((current) => (current === "ready" ? current : "error"));
      return;
    }
    if (epoch !== mutationEpoch.current) {
      void sync();
      return;
    }
    // A block that landed while this was in flight is newer than these rows: keep it.
    const known = (list: ConversationResponse[], current: InboxLists) =>
      list.map((row) => keepNewerBlock([...current.inbox, ...current.requests].find((c) => c.id === row.id), row));
    setLists((current) => ({
      inbox: known(rows, current),
      requests: requests ? known(requests, current) : current.requests,
    }));
    if (blockedNow) setBlockedUsers(blockedNow);
    setStatus("ready");
    const tails: Record<string, MessageResponse[]> = {};
    await Promise.all(
      rows
        .filter((row) => needsTail(stateRef.current, row))
        .map(async (row) => {
          try {
            tails[row.id] = (await listMessages(row.id, null, undefined, TAIL_PAGE)).items;
          } catch {
            // Left as it was; the next sync tries again.
          }
        }),
    );
    setState((current) => reconcile(current, rows, tails, me));

    // What arrived while this client was away is only "received" once it has actually been read from
    // the server, so the ones that were just fetched are held as they are and the rest are caught up.
    const mine = acker.current;
    if (mine) {
      for (const [conversationId, items] of Object.entries(tails)) mine.hold(conversationId, items);
      for (const row of [...rows, ...(requests ?? [])]) {
        if (row.hasUnread && row.lastMessageSenderId !== me && !row.inboxHidden && !(row.id in tails)) {
          void mine.catchUp(row.id, row.lastMessageAt);
        }
      }
    }
  }, [me]);

  /** Takes a conversation out of every list and out of the saved unread counts. */
  const forget = useCallback((conversationId: string) => {
    const without = (list: ConversationResponse[]) => list.filter((c) => c.id !== conversationId);
    setLists((current) => ({ inbox: without(current.inbox), requests: without(current.requests) }));
    setState((current) => dropConversation(current, conversationId));
  }, []);

  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the first sync fills state from the network once the account is known
    void sync();
    const onVisible = () => {
      if (document.visibilityState === "visible") void sync();
    };
    const timer = window.setInterval(onVisible, RESYNC_MS);
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);
    const stopReconnect = onStompConnect(() => void sync());
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      stopReconnect();
    };
  }, [me, sync]);

  useEffect(() => {
    if (!me) return;

    /**
     * A desktop notification for a message nobody is looking at — unless the viewer muted the
     * conversation. Decided once, at arrival: nothing is made up for it when a mute ends later. The
     * notification helper itself checks the viewer's setting, the permission and whether the tab is hidden.
     */
    const alert = (conversation: ConversationResponse | undefined, message: MessageResponse) => {
      if (!conversation || isMuted(conversation, Date.now())) return;
      if (notified.current.has(message.id)) return;
      notified.current.add(message.id);
      if (notified.current.size > 200) notified.current.delete(notified.current.values().next().value as string);
      const author = authorsRef.current.get(otherParticipantId(conversation, me));
      showBrowserNotification({
        id: `chat-${message.conversationId}`,
        title: author?.nickname ?? "New message",
        body: noticeBody(message),
      });
    };

    const onMessage = (message: MessageResponse) => {
      if (message.senderId === me) return;
      acker.current?.hold(message.conversationId, [message]);
      const known = listsRef.current;
      const viewed = isViewing(message.conversationId) ? message.conversationId : null;
      if (!viewed) {
        alert(
          known.requests.find((c) => c.id === message.conversationId) ??
            known.inbox.find((c) => c.id === message.conversationId),
          message,
        );
      }

      if (known.requests.some((c) => c.id === message.conversationId)) {
        // A request's message is the box's business: it marks the request unread, not the inbox.
        setLists((current) => ({
          ...current,
          requests: applyIncoming(current.requests, message, me, viewed),
        }));
      } else if (known.inbox.some((c) => c.id === message.conversationId)) {
        setLists((current) => ({ ...current, inbox: applyIncoming(current.inbox, message, me, viewed) }));
        // A thread being looked at reads it itself (see use-chat-thread) and the count stays put.
        if (!viewed) setState((current) => addUnread(current, message));
      } else {
        // A conversation this client has not seen — a first message from a stranger, or a friend's
        // new thread. The state event that follows places it; this fetch is the backstop.
        void sync();
      }
    };

    const onConversation = (conversation: ConversationResponse) => {
      setLists((current) => placeConversation(current, conversation, me));
      if (conversation.messagingBlocked === true) {
        // A block ends the follows both ways, including on the side that did not place it.
        const other = otherParticipantId(conversation, me);
        setFollowState(other, false);
        setFollowRequested(other, false);
      }
      if (conversation.hasUnread && conversation.requestState === null) void sync();
    };

    return subscribeTopic("/user/queue/chat", (body) => {
      const event: ChatEvent | null = parseChatEvent(body);
      if (!event) return;
      // Reactions, recalls and deletes change no unread count; a recalled preview arrives as CONVERSATION.
      if (event.type === "MESSAGE") onMessage(event.message);
      else if (event.type === "CONVERSATION") onConversation(event.conversation);
      else if (event.type === "CONVERSATION_REMOVED") forget(event.conversationId);
    });
  }, [me, sync, forget]);

  const othersKey = me
    ? [
        ...new Set(
          [...lists.inbox, ...lists.requests].map((conversation) => otherParticipantId(conversation, me)),
        ),
      ].join(",")
    : "";
  useEffect(() => {
    if (!othersKey) return;
    let cancelled = false;
    resolveAuthors(othersKey.split(",")).then((resolved) => {
      if (!cancelled) setAuthors(resolved);
    });
    return () => {
      cancelled = true;
    };
  }, [othersKey]);

  const markRead = useCallback((conversationId: string, readAt: string) => {
    setState((current) => markConversationReadLocally(current, conversationId, readAt));
    const clear = (list: ConversationResponse[]) =>
      list.map((c) => (c.id === conversationId && c.hasUnread ? { ...c, hasUnread: false } : c));
    setLists((current) => ({ inbox: clear(current.inbox), requests: clear(current.requests) }));
  }, []);

  const applyConversation = useCallback(
    (conversation: ConversationResponse) => {
      if (me) setLists((current) => placeConversation(current, conversation, me));
    },
    [me],
  );

  const acceptRequest = useCallback(
    async (conversationId: string) => {
      const accepted = await acceptMessageRequest(conversationId);
      applyConversation(accepted);
      return accepted;
    },
    [applyConversation],
  );

  const declineRequest = useCallback(
    async (conversationId: string) => {
      const declined = await declineMessageRequest(conversationId);
      applyConversation(declined);
      return declined;
    },
    [applyConversation],
  );

  const own = useCallback(async <T,>(request: Promise<T>): Promise<T> => {
    mutationEpoch.current += 1;
    try {
      return await request;
    } finally {
      mutationEpoch.current += 1;
    }
  }, []);

  const pin = useCallback(
    async (conversationId: string) => {
      const answer = await own(pinConversation(conversationId));
      applyConversation(answer);
      return answer;
    },
    [own, applyConversation],
  );
  const unpin = useCallback(
    async (conversationId: string) => {
      const answer = await own(unpinConversation(conversationId));
      applyConversation(answer);
      return answer;
    },
    [own, applyConversation],
  );
  const mute = useCallback(
    async (conversationId: string, length: MuteLength) => {
      const answer = await own(muteConversation(conversationId, length));
      applyConversation(answer);
      return answer;
    },
    [own, applyConversation],
  );
  const unmute = useCallback(
    async (conversationId: string) => {
      const answer = await own(unmuteConversation(conversationId));
      applyConversation(answer);
      return answer;
    },
    [own, applyConversation],
  );
  const deleteConversation = useCallback(
    async (conversationId: string) => {
      await own(deleteConversationForMe(conversationId));
      forget(conversationId);
    },
    [own, forget],
  );
  const setBlockedUser = useCallback((userId: string, isBlocked: boolean) => {
    // Counts as the viewer's own change: a list that was already being fetched is stale now.
    mutationEpoch.current += 2;
    // The conversation with them shows it at once; the server's answer (below, or the block event)
    // carries the version that settles it. Unblocking cannot say whether they blocked back, so that
    // part is left to the server rather than guessed.
    const patch = (list: ConversationResponse[]) =>
      list.map((c) =>
        me && otherParticipantId(c, me) === userId
          ? { ...c, blockedByViewer: isBlocked, messagingBlocked: isBlocked ? true : c.messagingBlocked }
          : c,
      );
    setLists((current) => ({ inbox: patch(current.inbox), requests: patch(current.requests) }));
    if (!isBlocked) {
      for (const c of [...listsRef.current.inbox, ...listsRef.current.requests]) {
        if (me && otherParticipantId(c, me) === userId) {
          getConversation(c.id).then(
            (fresh) => setLists((current) => placeConversation(current, fresh, me)),
            () => {},
          );
        }
      }
    }
    setBlockedUsers((current) => {
      const next = new Set(current);
      if (isBlocked) next.add(userId);
      else next.delete(userId);
      return next;
    });
  }, [me]);

  // Wakes the UI when the soonest timed mute ends, so a bell that should be gone is not left on screen.
  const expiry = useMemo(
    () => nextMuteExpiry([...lists.inbox, ...lists.requests], nowMs),
    [lists, nowMs],
  );
  useEffect(() => {
    if (expiry === null) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), Math.max(0, expiry - Date.now()) + 50);
    return () => window.clearTimeout(timer);
  }, [expiry]);
  useEffect(() => {
    // A tab shown again after a long sleep: timers may not have run.
    const refresh = () => setNowMs(Date.now());
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, []);

  const total = useMemo(() => unreadTotal(state), [state]);
  const byConversation = useMemo(
    () => Object.fromEntries(Object.entries(state.unread).map(([id, entry]) => [id, entry.ids.length])),
    [state],
  );
  const requestSummary = useMemo(() => requestCounts(lists.requests), [lists.requests]);
  const reload = useCallback(() => void sync(), [sync]);

  return useMemo(
    () => ({
      total,
      byConversation,
      conversations: lists.inbox,
      requests: lists.requests,
      requestSummary,
      authors,
      status,
      reload,
      markRead,
      applyConversation,
      acceptRequest,
      declineRequest,
      nowMs,
      pin,
      unpin,
      mute,
      unmute,
      deleteConversation,
      blockedUsers,
      setBlockedUser,
    }),
    [
      total,
      byConversation,
      lists,
      requestSummary,
      authors,
      status,
      reload,
      markRead,
      applyConversation,
      acceptRequest,
      declineRequest,
      nowMs,
      pin,
      unpin,
      mute,
      unmute,
      deleteConversation,
      blockedUsers,
      setBlockedUser,
    ],
  );
}
