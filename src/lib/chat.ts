import type {
  ConversationResponse,
  MessageResponse,
  MessageUpdate,
  ReactionView,
  Receipt,
  ReceiptMark,
  ReplyQuote,
} from "@/lib/api/conversations";
import { isApiError } from "@/lib/api/errors";

/** How long a request message waits before its sender may send one more (chat-service `SendPolicy.RETRY_AFTER`). */
export const REQUEST_RETRY_DAYS = 15;

/** When a request message sent at `sentAt` may be followed by another. */
export function retryAvailableAfter(sentAt: string): string {
  return new Date(Date.parse(sentAt) + REQUEST_RETRY_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

/**
 * The line a conversation shows under its name. One function for the inbox, the request box and
 * anything else that previews, so what the socket delivers and what a reload returns read the same.
 */
export function messagePreview(
  conversation: Pick<ConversationResponse, "lastMessageContent" | "lastMessageType" | "lastMessageSenderId"> &
    Partial<Pick<ConversationResponse, "lastMessageRecalled">>,
  me: string,
): string {
  const mine = conversation.lastMessageSenderId === me;
  if (conversation.lastMessageRecalled) return mine ? "You recalled a message" : "Message recalled";
  if (conversation.lastMessageType === "STICKER") return mine ? "You sent a sticker" : "Sent a sticker";
  if (conversation.lastMessageType === "VIDEO") return mine ? "You shared a video" : "Shared a video";
  if (conversation.lastMessageType === "STORY_REPLY") {
    return mine ? "You replied to their story" : "Replied to your story";
  }
  if (!conversation.lastMessageContent) return "No messages yet";
  return `${mine ? "You: " : ""}${conversation.lastMessageContent}`;
}

/** chat-service's `@Size(max = 2000)` on `content`. */
export const MAX_MESSAGE_LENGTH = 2000;

/**
 * The videos shared in a conversation, oldest share first, for the video page to step through: up is
 * the share before the one opened, down the one after. Only cards the viewer can open count — a
 * recalled message or a video that is gone is skipped, not a stop that leads nowhere — and a video
 * shared twice is listed once, at its first share, since the page finds its place by id.
 */
export function sharedVideoIds(messages: readonly MessageResponse[]): string[] {
  const ordered = messages
    .filter((m) => m.type === "VIDEO" && m.recalledAt === null && m.video?.state === "AVAILABLE")
    .sort((a, b) => {
      const delta = Date.parse(a.sentAt) - Date.parse(b.sentAt);
      if (delta !== 0 && Number.isFinite(delta)) return delta;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  return [...new Set(ordered.map((m) => m.video?.videoId).filter((id): id is string => !!id))];
}

export type MessageStatus = "SENT" | "DELIVERED" | "SEEN";

/** What the sender reads under their messages. */
export const STATUS_LABEL: Record<Exclude<MessageStatus, "SEEN">, string> = {
  SENT: "Sent",
  DELIVERED: "Delivered",
};

/**
 * Where a message is in the thread: by time, and by id for two sent in the same millisecond — the order
 * the server keeps them in. Ids are Snowflakes as strings: compared by length, then by digits, which is
 * numeric order without ever turning one into a (rounding) number.
 */
export function comparePosition(
  a: { sentAt: string; messageId: string },
  b: { sentAt: string; messageId: string },
): number {
  const byTime = Date.parse(a.sentAt) - Date.parse(b.sentAt);
  if (byTime !== 0 && Number.isFinite(byTime)) return byTime < 0 ? -1 : 1;
  if (a.messageId.length !== b.messageId.length) return a.messageId.length < b.messageId.length ? -1 : 1;
  return a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0;
}

const positionOf = (message: Pick<MessageResponse, "id" | "sentAt">) => ({
  sentAt: message.sentAt,
  messageId: message.id,
});

/**
 * A message of the viewer's as the other side has got to it, by position and never by time: seen when
 * their read mark reaches it, received when their delivered mark does, sent otherwise — which is also
 * the answer while nothing is known of them. A mark recorded later says nothing about the messages
 * sent after the one it names, so a newer message never inherits an older one's state.
 */
export function messageStatus(
  message: Pick<MessageResponse, "id" | "sentAt">,
  receipt: Receipt | null | undefined,
): MessageStatus {
  if (receipt?.read && comparePosition(positionOf(message), receipt.read) <= 0) return "SEEN";
  if (receipt?.delivered && comparePosition(positionOf(message), receipt.delivered) <= 0) return "DELIVERED";
  return "SENT";
}

/**
 * Marks only move forward: each takes the later position, so a late, repeated or reordered frame can
 * never take a state back, and a repeat of the same position keeps the time it was first recorded.
 * Seeing implies receiving, so the delivered mark is never left behind the read one.
 */
export function mergeReceipt(current: Receipt | null, next: Receipt): Receipt {
  const later = (a: ReceiptMark | null, b: ReceiptMark | null): ReceiptMark | null =>
    a === null ? b : b === null ? a : comparePosition(b, a) > 0 ? b : a;
  const read = later(current?.read ?? null, next.read);
  let delivered = later(current?.delivered ?? null, next.delivered);
  if (read && (!delivered || comparePosition(read, delivered) > 0)) delivered = read;
  return { userId: next.userId, delivered, read };
}

/**
 * Which of the viewer's messages carry a state, as the apps this mirrors do it: the newest one the
 * other side has seen keeps "seen", and the newest message overall says "sent" or "received" when it
 * is not that one. A recalled message has no state of its own — the label settles on the newest one
 * that still stands, so nothing is revealed or restored.
 */
export function statusTargets(
  messages: readonly MessageResponse[],
  me: string,
  receipt: Receipt | null | undefined,
): { seenId: string | null; latestId: string | null; latestStatus: Exclude<MessageStatus, "SEEN"> | null } {
  let latest: MessageResponse | null = null;
  let seen: MessageResponse | null = null;
  for (const message of messages) {
    if (message.senderId !== me || message.recalledAt !== null) continue;
    const later = (than: MessageResponse | null) =>
      than === null || comparePosition(positionOf(message), positionOf(than)) >= 0;
    if (later(latest)) latest = message;
    if (messageStatus(message, receipt) === "SEEN" && later(seen)) seen = message;
  }
  const latestStatus = latest ? messageStatus(latest, receipt) : null;
  return {
    seenId: seen?.id ?? null,
    latestId: latest && latest.id !== seen?.id ? latest.id : null,
    latestStatus: latestStatus && latestStatus !== "SEEN" ? latestStatus : null,
  };
}

/**
 * "Seen just now" within the first minute, then minutes, hours and days — worked out from when the server
 * recorded the read, against `nowMs`. With no usable time it says only "Seen": never an invented one.
 */
export function formatSeenAgo(at: string | null | undefined, nowMs: number): string {
  const recorded = at ? Date.parse(at) : Number.NaN;
  if (!Number.isFinite(recorded)) return "Seen";
  const seconds = Math.max(0, Math.floor((nowMs - recorded) / 1000));
  if (seconds < 60) return "Seen just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Seen ${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Seen ${hours} hr ago`;
  return `Seen ${Math.floor(hours / 24)} d ago`;
}

/** The longest note that goes with a shared video; chat-service's `MessagePayload.MAX_NOTE`. */
export const MAX_VIDEO_NOTE = 300;

/** A run of one sender's messages closer together than this reads as one burst. */
const RUN_GAP_MS = 5 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function isSendable(text: string): boolean {
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length <= MAX_MESSAGE_LENGTH;
}

/** Server order: `sentAt`, then id. Ids are numeric Snowflakes, so they compare as BigInt. */
function compareMessages(a: MessageResponse, b: MessageResponse): number {
  const byTime = Date.parse(a.sentAt) - Date.parse(b.sentAt);
  if (byTime !== 0) return byTime;
  try {
    const diff = BigInt(a.id) - BigInt(b.id);
    return diff < BigInt(0) ? -1 : diff > BigInt(0) ? 1 : 0;
  } catch {
    return a.id.localeCompare(b.id);
  }
}

/**
 * Folds `incoming` into `current`, oldest first, one entry per id. The same message reaches the
 * client as the POST response and as the topic frame, and a reconnect refetch overlaps what is
 * already on screen, so de-duplication is the rule rather than the exception.
 *
 * A copy is only replaced by one whose `revision` is not older: a page fetched before a recall
 * and delivered after it must not bring the text back.
 */
export function mergeMessages(
  current: readonly MessageResponse[],
  incoming: readonly MessageResponse[],
): MessageResponse[] {
  const byId = new Map<string, MessageResponse>();
  for (const message of current) byId.set(message.id, message);
  for (const message of incoming) {
    const held = byId.get(message.id);
    if (!held || message.revision >= held.revision) byId.set(message.id, message);
  }
  return [...byId.values()].sort(compareMessages);
}

const RECALLED_QUOTE: Pick<ReplyQuote, "state" | "type" | "content" | "sticker"> = {
  state: "RECALLED",
  type: null,
  content: null,
  sticker: null,
};

/** Rewrites the quote of every reply that points at `messageId`. */
function requote(
  messages: readonly MessageResponse[],
  messageId: string,
  change: (quote: ReplyQuote) => ReplyQuote,
): MessageResponse[] {
  return messages.map((message) =>
    message.replyTo?.messageId === messageId ? { ...message, replyTo: change(message.replyTo) } : message,
  );
}

/**
 * Applies a reaction change or a recall to the message it names. Ignored when it is older than
 * what is held (updates and REST pages cross each other), and a recall wins over any reaction.
 * Replies that quote a recalled message stop showing its text at once.
 */
export function applyUpdate(messages: readonly MessageResponse[], update: MessageUpdate): MessageResponse[] {
  const held = messages.find((message) => message.id === update.messageId);
  if (!held || update.revision < held.revision) return [...messages];

  const changed: MessageResponse = update.recalledAt
    ? {
        ...held,
        content: null,
        stickerId: null,
        sticker: null,
        recalledAt: update.recalledAt,
        reactions: [],
        revision: update.revision,
      }
    : { ...held, reactions: update.reactions, revision: update.revision };

  const next = messages.map((message) => (message.id === held.id ? changed : message));
  return update.recalledAt
    ? requote(next, held.id, (quote) => ({ ...quote, ...RECALLED_QUOTE, senderId: quote.senderId }))
    : next;
}

/**
 * Brings `current` in line with a page the server just returned for the newest end of the thread.
 * Messages the page returns are merged (revision-aware). A message the page does not return, but
 * sits inside what the page covers — newer than its oldest item (or anywhere when the page reached
 * the start) and older than its newest — is gone from the viewer's side: it was deleted in another
 * tab while the socket was down. Anything newer than the page's newest is left, since it may simply
 * have arrived after the page was cut.
 */
export function reconcileWindow(
  current: readonly MessageResponse[],
  page: readonly MessageResponse[],
  reachedStart: boolean,
): MessageResponse[] {
  if (page.length === 0) return [...current];
  const sorted = [...page].sort(compareMessages);
  const oldest = sorted[0];
  const newest = sorted[sorted.length - 1];
  const returned = new Set(page.map((message) => message.id));
  const kept = current.filter(
    (message) =>
      returned.has(message.id) ||
      compareMessages(message, newest) > 0 ||
      (!reachedStart && compareMessages(message, oldest) < 0),
  );
  return mergeMessages(kept, page);
}

/** The viewer deleted a message from their own side: it leaves the list and replies to it lose the quote. */
export function removeMessage(messages: readonly MessageResponse[], messageId: string): MessageResponse[] {
  return requote(
    messages.filter((message) => message.id !== messageId),
    messageId,
    (quote) => ({ ...quote, state: "UNAVAILABLE", senderId: null, type: null, content: null, sticker: null }),
  );
}

export interface ReactionGroup {
  emoji: string;
  count: number;
  /** The viewer is one of them: pressing it takes their reaction back. */
  mine: boolean;
}

/** One badge per emoji, most used first, ties by the order the emoji were first given. */
export function groupReactions(reactions: readonly ReactionView[], me: string): ReactionGroup[] {
  const groups = new Map<string, ReactionGroup>();
  for (const reaction of reactions) {
    const group = groups.get(reaction.emoji) ?? { emoji: reaction.emoji, count: 0, mine: false };
    group.count += 1;
    group.mine = group.mine || reaction.userId === me;
    groups.set(reaction.emoji, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

export function myReaction(message: MessageResponse, me: string): string | null {
  return message.reactions.find((reaction) => reaction.userId === me)?.emoji ?? null;
}

/** The six reactions chat-service accepts (`MessageServiceImpl.REACTIONS`), in the order offered. */
export const REACTION_EMOJIS = ["\u2764\uFE0F", "\uD83D\uDE02", "\uD83D\uDE2E", "\uD83D\uDE22", "\uD83D\uDE21", "\uD83D\uDC4D"];

/** A reply is possible to a message that still has something to quote. */
export function canReplyTo(message: MessageResponse): boolean {
  return message.recalledAt === null;
}

/** One line for the reply bar and for a quote, whatever the original was. */
export function quoteText(content: string | null, type: MessageResponse["type"] | null): string {
  if (type === "STICKER") return "Sticker";
  if (type === "VIDEO") return (content ?? "").trim() ? `Video · ${content?.trim()}` : "Video";
  if (type === "STORY_REPLY") return (content ?? "").trim() ? `Story reply · ${content?.trim()}` : "Story reply";
  return (content ?? "").replace(/\s+/g, " ").trim();
}

export function otherParticipantId(conversation: ConversationResponse, me: string): string {
  return conversation.participantIds.find((id) => id !== me) ?? me;
}

/**
 * The one ordering of the viewer's conversations, the same as chat-service's `ConversationViews.ORDER`
 * so a list the server sent and one updated live never disagree: pinned first with the latest pin on
 * top; then newest message first; the id breaks every tie. A new message in a pinned chat therefore
 * moves nothing, and an unpinned chat keeps ordering by activity.
 */
export function sortConversations(list: readonly ConversationResponse[]): ConversationResponse[] {
  const at = (value: string | null) => (value ? Date.parse(value) : Number.NEGATIVE_INFINITY);
  return [...list].sort((a, b) => {
    const pinned = at(b.pinnedAt) - at(a.pinnedAt);
    if (a.pinnedAt && b.pinnedAt && pinned !== 0) return pinned;
    if (a.pinnedAt && !b.pinnedAt) return -1;
    if (!a.pinnedAt && b.pinnedAt) return 1;
    const recent = at(b.lastMessageAt) - at(a.lastMessageAt);
    if (recent !== 0 && Number.isFinite(recent)) return recent;
    if (a.lastMessageAt && !b.lastMessageAt) return -1;
    if (!a.lastMessageAt && b.lastMessageAt) return 1;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
}

/** Alerts are silenced right now. A timed mute that has run out is no mute, whatever the list still says. */
export function isMuted(
  conversation: Pick<ConversationResponse, "muteMode" | "mutedUntil">,
  nowMs: number,
): boolean {
  if (conversation.muteMode === "INDEFINITE") return true;
  return (
    conversation.muteMode === "TIMED" &&
    conversation.mutedUntil !== null &&
    Date.parse(conversation.mutedUntil) > nowMs
  );
}

/** The soonest end of a timed mute still in force, to wake the UI up for; null when there is none. */
export function nextMuteExpiry(conversations: readonly ConversationResponse[], nowMs: number): number | null {
  let soonest: number | null = null;
  for (const conversation of conversations) {
    if (conversation.muteMode !== "TIMED" || conversation.mutedUntil === null) continue;
    const end = Date.parse(conversation.mutedUntil);
    if (end > nowMs && (soonest === null || end < soonest)) soonest = end;
  }
  return soonest;
}

/** What a desktop notification says about a message: the text, or what kind of message it was. */
export function noticeBody(message: Pick<MessageResponse, "type" | "content" | "recalledAt">): string {
  if (message.recalledAt) return "Sent a message";
  if (message.type === "STICKER") return "Sent a sticker";
  if (message.type === "VIDEO") return "Shared a video";
  if (message.type === "STORY_REPLY") return "Replied to your story";
  const text = (message.content ?? "").replace(/\s+/g, " ").trim();
  return text.length > 120 ? `${text.slice(0, 119)}…` : text || "Sent a message";
}

/**
 * Applies one live message to the conversation list: new preview, new time, unread when it came
 * from the other side and the thread is not the one open, and the row moves to the top.
 * A conversation the list has not seen yet is left to the caller to fetch.
 */
export function applyIncoming(
  conversations: readonly ConversationResponse[],
  message: MessageResponse,
  me: string,
  openId: string | null,
): ConversationResponse[] {
  const index = conversations.findIndex((conversation) => conversation.id === message.conversationId);
  if (index === -1) return [...conversations];

  const current = conversations[index];
  const newer = !current.lastMessageAt || Date.parse(message.sentAt) >= Date.parse(current.lastMessageAt);
  const updated: ConversationResponse = newer
    ? {
        ...current,
        lastMessageContent: message.content,
        lastMessageType: message.type,
        lastMessageSenderId: message.senderId,
        lastMessageRecalled: false,
        lastMessageAt: message.sentAt,
        hasUnread: message.senderId !== me && message.conversationId !== openId,
      }
    : current;

  return sortConversations([updated, ...conversations.filter((_, i) => i !== index)]);
}

export type ThreadItem =
  | { kind: "day"; key: string; label: string }
  | {
      kind: "message";
      key: string;
      message: MessageResponse;
      mine: boolean;
      /** First of a burst: gets the full bubble corner at the top. */
      startsRun: boolean;
      /** Last of a burst: gets the timestamp. */
      endsRun: boolean;
    };

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

export function dayLabel(at: Date, now: Date): string {
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return at.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: at.getFullYear() === now.getFullYear() ? undefined : "numeric",
  });
}

/** Oldest-first messages as a flat render list: day dividers, and run flags for the bubbles. */
export function buildThread(
  messages: readonly MessageResponse[],
  me: string,
  now = new Date(),
): ThreadItem[] {
  const items: ThreadItem[] = [];
  let lastDay: number | null = null;

  messages.forEach((message, index) => {
    const at = new Date(message.sentAt);
    const day = startOfDay(at);
    if (day !== lastDay) {
      items.push({ kind: "day", key: `day-${day}`, label: dayLabel(at, now) });
      lastDay = day;
    }

    const previous = messages[index - 1];
    const next = messages[index + 1];
    const joins = (other: MessageResponse | undefined) =>
      other !== undefined &&
      other.senderId === message.senderId &&
      startOfDay(new Date(other.sentAt)) === day &&
      Math.abs(Date.parse(other.sentAt) - at.getTime()) < RUN_GAP_MS;

    items.push({
      kind: "message",
      key: message.id,
      message,
      mine: message.senderId === me,
      startsRun: !joins(previous),
      endsRun: !joins(next),
    });
  });

  return items;
}

/** "9:41 AM" for today, "Yesterday", a weekday inside the week, else a short date. */
export function formatListTime(iso: string, now = new Date()): string {
  const at = new Date(iso);
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY_MS);
  if (days <= 0) return at.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  if (days === 1) return "Yesterday";
  if (days < 7) return at.toLocaleDateString(undefined, { weekday: "short" });
  return at.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Codes that mean the server's idea of what the viewer may send here differs from the client's:
 * the answer is to ask the server again (`getConversation`), not to show an error and carry on.
 */
const PERMISSION_CODES = new Set([
  "MESSAGE_REQUEST_LIMIT_REACHED",
  "MESSAGE_REQUEST_NOT_ACCEPTED",
  "MESSAGE_REQUEST_NOT_PENDING",
]);

export function isPermissionChange(error: unknown): boolean {
  return isApiError(error) && error.code !== null && PERMISSION_CODES.has(error.code);
}

/** Codes after which this thread cannot take a message, however many times it is retried. */
/** After these the message being replied to is gone for good, so the reply draft is dropped, not retried. */
export function isReplyTargetGone(error: unknown): boolean {
  return isApiError(error) && (error.code === "REPLY_TARGET_UNAVAILABLE" || error.code === "MESSAGE_NOT_FOUND");
}

const LOCKED_CODES = new Set([
  "MESSAGING_BLOCKED",
  "MESSAGING_NOT_ALLOWED",
  "NOT_CONVERSATION_PARTICIPANT",
  "CONVERSATION_NOT_FOUND",
]);

export function isThreadLocked(error: unknown): boolean {
  return isApiError(error) && error.code !== null && LOCKED_CODES.has(error.code);
}

/** Viewer-facing wording for a chat failure; the server's own message is English prose for logs. */
export function chatErrorMessage(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "MESSAGING_BLOCKED":
        return "You can't message this account.";
      case "MESSAGING_NOT_ALLOWED":
        return "This account doesn't accept messages from you.";
      case "CANNOT_MESSAGE_SELF":
        return "You can't message yourself.";
      case "NOT_CONVERSATION_PARTICIPANT":
      case "CONVERSATION_NOT_FOUND":
        return "This conversation isn't available.";
      case "BLOCK_CHECK_UNAVAILABLE":
      case "DM_SETTINGS_UNAVAILABLE":
        return "Messaging is temporarily unavailable. Try again in a moment.";
      case "VALIDATION_ERROR":
        return `Messages can be up to ${MAX_MESSAGE_LENGTH} characters.`;
      case "REPLY_TARGET_UNAVAILABLE":
        return "That message can no longer be replied to.";
      case "MESSAGE_RECALLED":
        return "That message was recalled.";
      case "MESSAGE_NOT_FOUND":
        return "That message is no longer here.";
      case "NOT_MESSAGE_AUTHOR":
        return "Only the sender can recall a message.";
      case "REACTION_NOT_ALLOWED":
        return "You can't react in this conversation right now.";
      case "INVALID_REACTION":
        return "That reaction isn't available.";
      case "PIN_LIMIT_REACHED":
        return "You can pin at most 3 conversations. Unpin one first.";
      case "ALREADY_BLOCKED":
        return "You've already blocked this account.";
      case "INVALID_STICKER":
        return "That sticker isn't available any more.";
      case "INVALID_MESSAGE":
        return "That message couldn't be sent.";
      case "MESSAGE_REQUEST_LIMIT_REACHED":
        return "You can send more messages once this request is accepted.";
      case "MESSAGE_REQUEST_NOT_ACCEPTED":
        return "Accept this message request before replying.";
      case "NOT_REQUEST_RECIPIENT":
        return "Only the person who received this request can answer it.";
      case "MESSAGE_REQUEST_NOT_PENDING":
        return "This request has already been answered.";
    }
    if (error.status === 0) return "Can't reach the server. Check your connection.";
    if (error.status === 429) return "You're sending too fast. Wait a moment.";
  }
  return "Something went wrong. Try again.";
}

/** A request somebody else opened and the viewer has not answered. */
export function isIncomingRequest(conversation: ConversationResponse, me: string): boolean {
  return (
    conversation.requestState === "PENDING" &&
    conversation.initiatorId !== null &&
    conversation.initiatorId !== me
  );
}

/** A request the viewer deleted: gone from their lists, still on the server. */
export function isDeletedByViewer(conversation: ConversationResponse, me: string): boolean {
  return conversation.requestState === "DECLINED" && conversation.initiatorId !== me;
}

export interface InboxLists {
  /** Ordinary conversations plus requests the viewer opened. */
  inbox: ConversationResponse[];
  /** Requests waiting on the viewer. Never part of `inbox`, so never part of its unread. */
  requests: ConversationResponse[];
}


/**
 * `next` with the block fields of `prev` when `prev` is newer: a response that was in flight while a
 * block or unblock landed, a late resync or a replayed event must not bring the old state back.
 * Equal versions take `next`, so an answer that only adds what was unknown still applies.
 */
export function keepNewerBlock(
  prev: ConversationResponse | undefined,
  next: ConversationResponse,
): ConversationResponse {
  if (!prev || prev.blockVersion <= next.blockVersion) return next;
  return {
    ...next,
    blockedByViewer: prev.blockedByViewer,
    messagingBlocked: prev.messagingBlocked,
    blockVersion: prev.blockVersion,
  };
}

/** The viewer's own block, when the server says so; `null` when it could not tell. */
export function isBlockedByViewer(conversation: ConversationResponse): boolean | null {
  return conversation.blockedByViewer;
}

/** Nothing can be sent into it (a block either way). Unknown counts as open: the server still enforces. */
export function isMessagingBlocked(conversation: ConversationResponse): boolean {
  return conversation.messagingBlocked === true || conversation.blockedByViewer === true;
}

/**
 * Puts a conversation where the viewer's state says it belongs, removing it from wherever it was:
 * a request that arrives joins the request box, one that is accepted moves to the inbox, one the
 * viewer deleted disappears. The same conversation is never in both lists.
 */
export function placeConversation(
  lists: InboxLists,
  conversation: ConversationResponse,
  me: string,
): InboxLists {
  conversation = keepNewerBlock(
    lists.inbox.find((c) => c.id === conversation.id) ?? lists.requests.find((c) => c.id === conversation.id),
    conversation,
  );
  const inbox = lists.inbox.filter((c) => c.id !== conversation.id);
  const requests = lists.requests.filter((c) => c.id !== conversation.id);

  // Deleted from the viewer's side with nothing newer since: in none of their lists.
  if (conversation.inboxHidden || isDeletedByViewer(conversation, me)) return { inbox, requests };
  if (isIncomingRequest(conversation, me)) {
    // A request with no message yet is not a request: there is nothing to look at or answer.
    return { inbox, requests: conversation.lastMessageAt ? sortConversations([conversation, ...requests]) : requests };
  }
  return { inbox: sortConversations([conversation, ...inbox]), requests };
}

/** Messages in a request thread are the other side's alone, so the box's counters read the list itself. */
export function requestCounts(requests: readonly ConversationResponse[]): { pending: number; unread: number } {
  return { pending: requests.length, unread: requests.filter((c) => c.hasUnread).length };
}
