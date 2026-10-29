"use client";

import { apiFetch } from "@/lib/api/client";
import { parseJsonPreservingIds } from "@/lib/api/json";

/**
 * chat-service, direct messages. Ids arrive as numbers in places (`participantIds`, `senderId`)
 * and as strings in others; `lib/api/json.ts` quotes the long ones, and the mappers below
 * `String()` the rest so a short id in a test fixture compares like a Snowflake.
 */

/** Null on an ordinary conversation; see `sendPermission` for what the viewer may do. */
export type MessageRequestState = "PENDING" | "DECLINED";

/**
 * What the viewer may do here, decided by the server — never inferred from message counts.
 * - ALLOWED: ordinary conversation.
 * - FIRST_MESSAGE_ONLY: the viewer opened a request and has its one message left.
 * - REQUEST_SENT: that message is used (or the request was deleted: the two look the same).
 *   `retryAvailableAt` says when one more may be sent.
 * - AWAITING_ACCEPT: the viewer received the request and has to accept it before replying.
 * - REOPEN_ON_SEND: the viewer deleted this request. Opening the thread changes nothing; sending a
 *   message reopens it, which lets the other side reply — so the client confirms first.
 */
export type SendPermission =
  | "ALLOWED"
  | "FIRST_MESSAGE_ONLY"
  | "REQUEST_SENT"
  | "AWAITING_ACCEPT"
  | "REOPEN_ON_SEND";

/** Whether alerts from a conversation are silenced for the viewer right now, as the server's clock sees it. */
export type MuteMode = "NONE" | "TIMED" | "INDEFINITE";

/** How long a mute lasts; the server works out the end. */
export type MuteLength = "ONE_HOUR" | "EIGHT_HOURS" | "TWENTY_FOUR_HOURS" | "INDEFINITE";

/** Emoji are not a type: they are characters inside a TEXT message's content. */
export type MessageType = "TEXT" | "STICKER" | "VIDEO";

/**
 * A shared video as the viewer may see it right now, read by the server on every load — never a
 * snapshot from the moment of sending. AVAILABLE carries the card's content; UNAVAILABLE (deleted,
 * private, moderated, blocked) and UNKNOWN (the video service could not answer, not a deletion)
 * carry the id and the state alone.
 */
export interface VideoCard {
  videoId: string;
  state: "AVAILABLE" | "UNAVAILABLE" | "UNKNOWN";
  ownerId: string | null;
  thumbnailUrl: string | null;
  title: string | null;
  durationSeconds: number | null;
}

/** A sticker as it is drawn. `url` is public and unsigned, so it keeps working in old history. */
export interface StickerView {
  stickerId: string;
  name: string;
  url: string;
  width: number;
  height: number;
}

export interface StickerPack {
  packId: string;
  name: string;
  stickers: StickerView[];
}

export interface ConversationResponse {
  id: string;
  participantIds: string[];
  lastMessageContent: string | null;
  /** What the last message was, so the preview can say "sticker"; null before the first message. */
  lastMessageType: MessageType | null;
  lastMessageSenderId: string | null;
  lastMessageAt: string | null;
  createdAt: string | null;
  /** Computed for the viewer: a message from the other side landed after they last read. */
  hasUnread: boolean;
  requestState: MessageRequestState | null;
  /** Who opened the thread; null on conversations that predate requests. */
  initiatorId: string | null;
  sendPermission: SendPermission;
  /** While the viewer's own request message waits: when they may send one more. Otherwise null. */
  retryAvailableAt: string | null;
  /** The newest message was taken back by its sender: the preview says so instead of quoting it. */
  lastMessageRecalled: boolean;
  /** When the viewer pinned it, or null. A later pin outranks an earlier one. Theirs alone. */
  pinnedAt: string | null;
  muteMode: MuteMode;
  /** The end of a TIMED mute; null otherwise. */
  mutedUntil: string | null;
  /**
   * The viewer deleted it from their side and nothing newer has arrived: it belongs in none of their
   * lists, and opening its URL shows an empty thread.
   */
  inboxHidden: boolean;
  /**
   * The viewer has blocked the other account. Null: the server could not tell right now (an outage,
   * not a block). Only the viewer's own block is ever named; the other side's is not.
   */
  blockedByViewer: boolean | null;
  /** Messaging is closed because of a block in either direction. Null as above. */
  messagingBlocked: boolean | null;
  /** Grows with every block and unblock of this pair: an older answer never replaces a newer one. */
  blockVersion: number;
}

/**
 * A position in a conversation the other participant has reached: `messageId` and `sentAt` name the
 * newest of the viewer's messages it covers, `at` is when the server recorded it. The position is what
 * proves anything — a message is received or seen when it is at or before the mark — and `at` is only
 * what "seen 13 minutes ago" is read from.
 */
export interface ReceiptMark {
  messageId: string;
  sentAt: string;
  at: string;
}

/** How far one participant has got: what they received, and what they actually looked at. */
export interface Receipt {
  userId: string;
  delivered: ReceiptMark | null;
  read: ReceiptMark | null;
}

type RawReceipt = { userId: string | number; delivered?: ReceiptMark | null; read?: ReceiptMark | null };

export function normalizeReceipt(raw: RawReceipt): Receipt {
  return { userId: String(raw.userId), delivered: raw.delivered ?? null, read: raw.read ?? null };
}

/** One person's reaction on a message. */
export interface ReactionView {
  userId: string;
  emoji: string;
}

/**
 * The original a reply points at, as the viewer may see it right now.
 * - OK: carries the sender and the text or sticker.
 * - RECALLED: taken back by its sender; no content.
 * - UNAVAILABLE: deleted from the viewer's own side; no content, no sender.
 */
export interface ReplyQuote {
  messageId: string;
  state: "OK" | "RECALLED" | "UNAVAILABLE";
  senderId: string | null;
  type: MessageType | null;
  content: string | null;
  sticker: StickerView | null;
  /** On a quoted video: its card, with only the id and state when it cannot be shown. */
  video?: VideoCard | null;
}

export interface MessageResponse {
  id: string;
  conversationId: string;
  senderId: string;
  type: MessageType;
  /** Null on a sticker. */
  content: string | null;
  /** Present only on a sticker. */
  stickerId: string | null;
  /** The catalog entry for `stickerId`; null on text, and on a sticker the catalog no longer knows. */
  sticker: StickerView | null;
  /** Present only on a video; `content` is then its optional note. */
  video?: VideoCard | null;
  sentAt: string;
  replyToMessageId: string | null;
  replyTo: ReplyQuote | null;
  /** Set once the sender took the message back; content, sticker and reactions are gone then. */
  recalledAt: string | null;
  reactions: ReactionView[];
  /** Orders changes to one message: a copy is only replaced by one that is not older. */
  revision: number;
}

/** What changed about a message — reactions or a recall — and nothing else. */
export interface MessageUpdate {
  messageId: string;
  conversationId: string;
  revision: number;
  recalledAt: string | null;
  reactions: ReactionView[];
}

/**
 * What a send asks for: text, a sticker by id, or a video by id with an optional note; any may reply to
 * a message by its id. A video is never described by the client — the server reads it. Its
 * `clientRequestId` makes a repeated request return the first message instead of a second one.
 */
export type SendPayload = (
  | { type: "TEXT"; content: string }
  | { type: "STICKER"; stickerId: string }
  | { type: "VIDEO"; videoId: string; content?: string; clientRequestId: string }
) & { replyToMessageId?: string };

export interface MessagePage {
  /** Newest first, as the server sorts them. */
  items: MessageResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}

/**
 * One frame on the viewer's own `/user/queue/chat`. `MESSAGE` is a message that landed in any of
 * their conversations, including ones they have not fetched; `CONVERSATION` is a conversation as
 * the viewer now sees it (a request arrived, was accepted or deleted, an allowance was used).
 */
export type ChatEvent =
  | { type: "MESSAGE"; conversationId: string; message: MessageResponse }
  | { type: "CONVERSATION"; conversationId: string; conversation: ConversationResponse }
  | { type: "MESSAGE_UPDATED"; conversationId: string; update: MessageUpdate }
  | { type: "MESSAGE_HIDDEN"; conversationId: string; messageId: string }
  | { type: "RECEIPT"; conversationId: string; receipt: Receipt }
  | { type: "TYPING"; conversationId: string; userId: string; typing: boolean }
  | { type: "CONVERSATION_REMOVED"; conversationId: string };

type RawConversation = Omit<
  ConversationResponse,
  | "participantIds"
  | "lastMessageSenderId"
  | "lastMessageType"
  | "initiatorId"
  | "requestState"
  | "sendPermission"
  | "retryAvailableAt"
  | "lastMessageRecalled"
  | "pinnedAt"
  | "muteMode"
  | "mutedUntil"
  | "inboxHidden"
  | "blockedByViewer"
  | "messagingBlocked"
  | "blockVersion"
> & {
  participantIds: (string | number)[];
  lastMessageType?: MessageType | null;
  lastMessageSenderId: string | number | null;
  initiatorId?: string | number | null;
  requestState?: MessageRequestState | null;
  sendPermission?: SendPermission;
  retryAvailableAt?: string | null;
  lastMessageRecalled?: boolean;
  pinnedAt?: string | null;
  muteMode?: MuteMode;
  mutedUntil?: string | null;
  inboxHidden?: boolean;
  blockedByViewer?: boolean | null;
  messagingBlocked?: boolean | null;
  blockVersion?: number | null;
};
/** Messages stored before types existed arrive with no `type`, and are text. */
type RawReaction = { userId: string | number; emoji: string };
type RawVideo = Omit<VideoCard, "ownerId" | "thumbnailUrl" | "title" | "durationSeconds"> & {
  ownerId?: string | number | null;
  thumbnailUrl?: string | null;
  title?: string | null;
  durationSeconds?: number | null;
};
type RawQuote = Omit<ReplyQuote, "senderId" | "video"> & {
  senderId?: string | number | null;
  video?: RawVideo | null;
};
type RawUpdate = Omit<MessageUpdate, "reactions" | "recalledAt"> & {
  recalledAt?: string | null;
  reactions?: RawReaction[] | null;
};
type RawMessage = Omit<
  MessageResponse,
  | "senderId"
  | "type"
  | "content"
  | "stickerId"
  | "sticker"
  | "video"
  | "replyToMessageId"
  | "replyTo"
  | "recalledAt"
  | "reactions"
  | "revision"
> & {
  video?: RawVideo | null;
  senderId: string | number;
  replyToMessageId?: string | null;
  replyTo?: RawQuote | null;
  recalledAt?: string | null;
  reactions?: RawReaction[] | null;
  revision?: number;
  type?: MessageType | null;
  content?: string | null;
  stickerId?: string | null;
  sticker?: StickerView | null;
};

export function normalizeConversation(raw: RawConversation): ConversationResponse {
  return {
    ...raw,
    participantIds: raw.participantIds.map(String),
    lastMessageSenderId: raw.lastMessageSenderId == null ? null : String(raw.lastMessageSenderId),
    // A conversation whose preview predates types has a last message and no type: that is text.
    lastMessageType: raw.lastMessageType ?? (raw.lastMessageAt ? "TEXT" : null),
    requestState: raw.requestState ?? null,
    initiatorId: raw.initiatorId == null ? null : String(raw.initiatorId),
    // A backend that predates requests sends none of these, and such a conversation is ordinary.
    sendPermission: raw.sendPermission ?? "ALLOWED",
    retryAvailableAt: raw.retryAvailableAt ?? null,
    lastMessageRecalled: raw.lastMessageRecalled ?? false,
    pinnedAt: raw.pinnedAt ?? null,
    muteMode: raw.muteMode ?? "NONE",
    mutedUntil: raw.mutedUntil ?? null,
    inboxHidden: raw.inboxHidden ?? false,
    blockedByViewer: raw.blockedByViewer ?? null,
    messagingBlocked: raw.messagingBlocked ?? null,
    blockVersion: raw.blockVersion ?? 0,
  };
}

function normalizeReactions(raw: readonly RawReaction[] | null | undefined): ReactionView[] {
  return (raw ?? []).map((reaction) => ({ userId: String(reaction.userId), emoji: reaction.emoji }));
}

function normalizeQuote(raw: RawQuote | null | undefined): ReplyQuote | null {
  if (!raw) return null;
  return {
    ...raw,
    senderId: raw.senderId == null ? null : String(raw.senderId),
    type: raw.type ?? null,
    content: raw.content ?? null,
    sticker: raw.sticker ?? null,
    video: normalizeVideo(raw.video),
  };
}

function normalizeVideo(raw: RawVideo | null | undefined): VideoCard | null {
  if (!raw) return null;
  return {
    videoId: String(raw.videoId),
    state: raw.state,
    ownerId: raw.ownerId == null ? null : String(raw.ownerId),
    thumbnailUrl: raw.thumbnailUrl ?? null,
    title: raw.title ?? null,
    durationSeconds: raw.durationSeconds ?? null,
  };
}

export function normalizeUpdate(raw: RawUpdate): MessageUpdate {
  return { ...raw, recalledAt: raw.recalledAt ?? null, reactions: normalizeReactions(raw.reactions) };
}

export function normalizeMessage(raw: RawMessage): MessageResponse {
  return {
    ...raw,
    senderId: String(raw.senderId),
    type: raw.type ?? "TEXT",
    content: raw.content ?? null,
    stickerId: raw.stickerId ?? null,
    sticker: raw.sticker ?? null,
    video: normalizeVideo(raw.video),
    replyToMessageId: raw.replyToMessageId ?? null,
    replyTo: normalizeQuote(raw.replyTo),
    recalledAt: raw.recalledAt ?? null,
    reactions: normalizeReactions(raw.reactions),
    revision: raw.revision ?? 0,
  };
}

/**
 * A STOMP frame body as a `ChatEvent`, or null if it is not one. Parsed with the same id-preserving
 * reader as the REST client: `JSON.parse` would round an 18-digit `senderId` and the "is this mine"
 * comparison would quietly stop holding.
 */
export function parseChatEvent(body: string): ChatEvent | null {
  let frame: Record<string, unknown>;
  try {
    frame = parseJsonPreservingIds<Record<string, unknown>>(body);
  } catch {
    return null;
  }
  if (typeof frame !== "object" || frame === null) return null;

  if (frame.type === "MESSAGE" && typeof frame.message === "object" && frame.message !== null) {
    const message = frame.message as RawMessage;
    if (typeof message.conversationId !== "string" || message.senderId == null) return null;
    return { type: "MESSAGE", conversationId: message.conversationId, message: normalizeMessage(message) };
  }
  if (frame.type === "CONVERSATION" && typeof frame.conversation === "object" && frame.conversation !== null) {
    const raw = frame.conversation as RawConversation;
    if (typeof raw.id !== "string" || !Array.isArray(raw.participantIds)) return null;
    return { type: "CONVERSATION", conversationId: raw.id, conversation: normalizeConversation(raw) };
  }
  if (frame.type === "MESSAGE_UPDATED" && typeof frame.update === "object" && frame.update !== null) {
    const update = frame.update as RawUpdate;
    if (typeof update.messageId !== "string" || typeof update.conversationId !== "string") return null;
    return { type: "MESSAGE_UPDATED", conversationId: update.conversationId, update: normalizeUpdate(update) };
  }
  if (frame.type === "RECEIPT" && typeof frame.receipt === "object" && frame.receipt !== null) {
    const raw = frame.receipt as RawReceipt & { conversationId?: string };
    if (typeof raw.conversationId !== "string" || raw.userId == null) return null;
    return { type: "RECEIPT", conversationId: raw.conversationId, receipt: normalizeReceipt(raw) };
  }
  if (frame.type === "TYPING" && typeof frame.typing === "object" && frame.typing !== null) {
    const raw = frame.typing as { conversationId?: unknown; userId?: string | number; typing?: unknown };
    if (typeof raw.conversationId !== "string" || raw.userId == null || typeof raw.typing !== "boolean") return null;
    return { type: "TYPING", conversationId: raw.conversationId, userId: String(raw.userId), typing: raw.typing };
  }
  if (frame.type === "CONVERSATION_REMOVED" && typeof frame.conversationId === "string") {
    return { type: "CONVERSATION_REMOVED", conversationId: frame.conversationId };
  }
  if (frame.type === "MESSAGE_HIDDEN" && typeof frame.messageId === "string" && typeof frame.conversationId === "string") {
    return { type: "MESSAGE_HIDDEN", conversationId: frame.conversationId, messageId: frame.messageId };
  }
  return null;
}

/** Parses a message frame from a conversation's own topic, with ids kept exact. */
export function parseMessageFrame(body: string): MessageResponse | null {
  let frame: unknown;
  try {
    frame = parseJsonPreservingIds<unknown>(body);
  } catch {
    return null;
  }
  if (typeof frame !== "object" || frame === null) return null;
  const raw = frame as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    // A sticker has no text, so `content` may be null or absent; anything else must be a string.
    (raw.content != null && typeof raw.content !== "string") ||
    typeof raw.sentAt !== "string" ||
    typeof raw.conversationId !== "string" ||
    raw.senderId == null
  ) {
    return null;
  }
  return normalizeMessage(frame as RawMessage);
}

/** The viewer's inbox, newest activity first: ordinary conversations and requests they started. */
export async function listConversations(): Promise<ConversationResponse[]> {
  const rows = await apiFetch<RawConversation[]>("/conversations", { auth: "required" });
  return rows.map(normalizeConversation);
}

/** Message requests waiting on the viewer, newest first. */
export async function listMessageRequests(): Promise<ConversationResponse[]> {
  const rows = await apiFetch<RawConversation[]>("/conversations/requests", { auth: "required" });
  return rows.map(normalizeConversation);
}

/** Recipient only. Safe to repeat: accepting an accepted request returns it unchanged. */
export async function acceptMessageRequest(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/accept`, {
    method: "POST",
    auth: "required",
  });
  return normalizeConversation(raw);
}

/** Recipient only. Safe to repeat. The thread and its message are kept; only the request goes. */
export async function declineMessageRequest(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/decline`, {
    method: "POST",
    auth: "required",
  });
  return normalizeConversation(raw);
}

/**
 * Get-or-create. For a pair that does not follow each other the new thread is a message request:
 * its opener gets one message, and reopening it never starts a second request.
 */
export async function openConversation(participantId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>("/conversations", {
    method: "POST",
    // A string, not Number(): a Snowflake is past 2^53 and would be rounded. Jackson reads it into the Long.
    body: { participantId },
    auth: "required",
  });
  return normalizeConversation(raw);
}

export async function getConversation(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}`, {
    auth: "required",
  });
  return normalizeConversation(raw);
}

export async function listMessages(
  conversationId: string,
  cursor?: string | null,
  signal?: AbortSignal,
  size = 30,
): Promise<MessagePage> {
  const page = await apiFetch<
    Omit<MessagePage, "items"> & { items: RawMessage[] }
  >(`/conversations/${conversationId}/messages`, {
    auth: "required",
    query: { cursor: cursor ?? undefined, size },
    signal,
  });
  return { ...page, items: page.items.map(normalizeMessage) };
}

export async function sendMessage(
  conversationId: string,
  payload: SendPayload,
): Promise<MessageResponse> {
  const raw = await apiFetch<RawMessage>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    body: payload,
    auth: "required",
  });
  return normalizeMessage(raw);
}

/** The stickers that can be sent. The images are public URLs on the media store, not API calls. */
export function listStickerPacks(): Promise<StickerPack[]> {
  return apiFetch<StickerPack[]>("/conversations/stickers", { auth: "required" });
}

/** The other participant's markers, for a sender to show "Delivered" and "Seen". */
export async function getReceipts(conversationId: string, signal?: AbortSignal): Promise<Receipt> {
  const raw = await apiFetch<RawReceipt>(`/conversations/${conversationId}/messages/receipts`, {
    auth: "required",
    signal,
  });
  return normalizeReceipt(raw);
}

/**
 * This client now holds these messages of the other side. The server moves the delivered mark only
 * across a run of messages that are all named, and answers with the viewer's own marks.
 */
export async function acknowledgeDelivered(conversationId: string, messageIds: string[]): Promise<Receipt> {
  const raw = await apiFetch<RawReceipt>(`/conversations/${conversationId}/messages/delivered`, {
    method: "POST",
    body: { messageIds },
    auth: "required",
  });
  return normalizeReceipt(raw);
}

/**
 * The viewer has looked at the thread up to `messageId`, a message of the other side that is on screen.
 * Answers with the viewer's own marks.
 */
export async function acknowledgeRead(conversationId: string, messageId: string): Promise<Receipt> {
  const raw = await apiFetch<RawReceipt>(`/conversations/${conversationId}/messages/read`, {
    method: "POST",
    body: { messageId },
    auth: "required",
  });
  return normalizeReceipt(raw);
}

export async function reactToMessage(
  conversationId: string,
  messageId: string,
  emoji: string,
): Promise<MessageUpdate> {
  const raw = await apiFetch<RawUpdate>(`/conversations/${conversationId}/messages/${messageId}/reaction`, {
    method: "PUT",
    body: { emoji },
    auth: "required",
  });
  return normalizeUpdate(raw);
}

export async function removeReaction(conversationId: string, messageId: string): Promise<MessageUpdate> {
  const raw = await apiFetch<RawUpdate>(`/conversations/${conversationId}/messages/${messageId}/reaction`, {
    method: "DELETE",
    auth: "required",
  });
  return normalizeUpdate(raw);
}

/** For everyone, sender only. Not the same as `hideMessage`, which only removes it from the caller's side. */
export async function recallMessage(conversationId: string, messageId: string): Promise<MessageUpdate> {
  const raw = await apiFetch<RawUpdate>(`/conversations/${conversationId}/messages/${messageId}/recall`, {
    method: "POST",
    auth: "required",
  });
  return normalizeUpdate(raw);
}

/** Deletes the message from the caller's own view only; the other person still has it. */
export function hideMessage(conversationId: string, messageId: string): Promise<null> {
  return apiFetch<null>(`/conversations/${conversationId}/messages/${messageId}/hide`, {
    method: "POST",
    auth: "required",
  });
}

/** Pins it above the viewer's others. Refused with PIN_LIMIT_REACHED when three are already pinned. */
export async function pinConversation(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/pin`, {
    method: "PUT",
    auth: "required",
  });
  return normalizeConversation(raw);
}

export async function unpinConversation(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/pin`, {
    method: "DELETE",
    auth: "required",
  });
  return normalizeConversation(raw);
}

/** Silences alerts from this conversation for the viewer only. Messages still arrive. */
export async function muteConversation(
  conversationId: string,
  duration: MuteLength,
): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/mute`, {
    method: "PUT",
    body: { duration },
    auth: "required",
  });
  return normalizeConversation(raw);
}

export async function unmuteConversation(conversationId: string): Promise<ConversationResponse> {
  const raw = await apiFetch<RawConversation>(`/conversations/${conversationId}/mute`, {
    method: "DELETE",
    auth: "required",
  });
  return normalizeConversation(raw);
}

/** Deletes the conversation from the viewer's side only; the other person keeps their copy. Safe to repeat. */
export function deleteConversationForMe(conversationId: string): Promise<null> {
  return apiFetch<null>(`/conversations/${conversationId}`, { method: "DELETE", auth: "required" });
}
