import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { isApiError } from "@/lib/api/errors";
import { chatErrorMessage, isDeletedByViewer, otherParticipantId } from "@/lib/chat";
import type { Author } from "@/types/tiktok";

/** How many people one send may go to, and how many conversations are worked on at once. */
export const MAX_RECIPIENTS = 10;
export const SHARE_CONCURRENCY = 3;
/** Recent people offered when nothing is typed. */
export const RECENT_LIMIT = 20;

export interface ShareRecipient {
  userId: string;
  author: Author;
}

/**
 * The people the viewer talked to most recently, newest message first. Ordered by the time of the
 * last message — not by the inbox's own order, where a pinned old chat sits on top — and without the
 * viewer, anyone twice, conversations they deleted from their side, or ones a block has closed.
 */
export function recentRecipients(
  conversations: readonly ConversationResponse[],
  authors: ReadonlyMap<string, Author>,
  me: string,
  limit = RECENT_LIMIT,
): ShareRecipient[] {
  // Epoch 0 for "no message yet", so the difference stays finite and such a chat sorts last.
  const at = (c: ConversationResponse) => (c.lastMessageAt ? Date.parse(c.lastMessageAt) : 0);
  const seen = new Set<string>();
  const out: ShareRecipient[] = [];
  const ordered = [...conversations].sort((a, b) => {
    const delta = at(b) - at(a);
    if (delta !== 0) return delta;
    return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
  });
  for (const conversation of ordered) {
    if (conversation.inboxHidden || isDeletedByViewer(conversation, me) || cannotMessage(conversation)) continue;
    const userId = otherParticipantId(conversation, me);
    const author = authors.get(userId);
    if (userId === me || seen.has(userId) || !author) continue;
    seen.add(userId);
    out.push({ userId, author });
    if (out.length >= limit) break;
  }
  return out;
}

/** A conversation the server says nothing can go into; unknown (null) is left to the send, which checks again. */
function cannotMessage(conversation: ConversationResponse): boolean {
  return conversation.messagingBlocked === true || conversation.blockedByViewer === true;
}

/** Why this person cannot be picked, or null. Only what is already known; the server decides at send time. */
export function unavailableReason(
  userId: string,
  conversations: readonly ConversationResponse[],
  me: string,
): string | null {
  const known = conversations.find((c) => otherParticipantId(c, me) === userId);
  if (!known) return null;
  return refusalOf(known);
}

/** Adds or removes one person by user id; past the cap an add changes nothing. */
export function togglePick(
  picked: ReadonlyMap<string, ShareRecipient>,
  recipient: ShareRecipient,
): ReadonlyMap<string, ShareRecipient> {
  const next = new Map(picked);
  if (next.delete(recipient.userId)) return next;
  if (picked.size >= MAX_RECIPIENTS) return picked;
  next.set(recipient.userId, recipient);
  return next;
}

export type RecipientResult =
  | { ok: true; message: MessageResponse }
  | { ok: false; error: unknown; reason: string };

export interface ShareDeps {
  openConversation: (userId: string) => Promise<ConversationResponse>;
  sendMessage: (
    conversationId: string,
    payload: { type: "VIDEO"; videoId: string; content?: string; clientRequestId: string },
  ) => Promise<MessageResponse>;
  /** Asks about the recipients whose deleted request this send would reopen; false cancels the whole send. */
  confirmReopen: (recipients: ShareRecipient[]) => Promise<boolean>;
}

export interface ShareRun {
  videoId: string;
  note: string;
  /** Kept for retries of the same share, so a lost response cannot become a second message. */
  attemptId: string;
  recipients: readonly ShareRecipient[];
  /** Already delivered in this attempt: never sent again. */
  alreadySent: ReadonlySet<string>;
}

/** The key the server dedupes on: stable per attempt and recipient. */
export function requestKey(attemptId: string, userId: string): string {
  return `${attemptId}:${userId}`;
}

/** Runs `task` over `items` with at most `limit` in flight; results keep the input's order. */
export async function mapLimit<T, R>(items: readonly T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await task(items[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

/**
 * Sends one video to each recipient as that pair's own conversation, through the ordinary send
 * endpoint: block, DM settings, the request rules and reopening are the server's, checked again for
 * every person. Each person succeeds or fails alone; nobody's failure takes back another's message.
 *
 * Returns null when the viewer declined to reopen a deleted request — nothing has been sent then,
 * and the caller keeps the picks and the note as they were.
 */
export async function runShare(run: ShareRun, deps: ShareDeps): Promise<Map<string, RecipientResult> | null> {
  const results = new Map<string, RecipientResult>();
  const todo = run.recipients.filter((r) => !run.alreadySent.has(r.userId));
  const fail = (userId: string, error: unknown) =>
    results.set(userId, { ok: false, error, reason: describeFailure(error) });

  const opened = new Map<string, ConversationResponse>();
  await mapLimit(todo, SHARE_CONCURRENCY, async (recipient) => {
    try {
      opened.set(recipient.userId, await deps.openConversation(recipient.userId));
    } catch (error) {
      fail(recipient.userId, error);
    }
  });

  const reopening = todo.filter((r) => opened.get(r.userId)?.sendPermission === "REOPEN_ON_SEND");
  if (reopening.length > 0 && !(await deps.confirmReopen(reopening))) return null;

  const sendable = todo.filter((recipient) => {
    const conversation = opened.get(recipient.userId);
    if (!conversation) return false;
    const refusal = refusalOf(conversation);
    if (refusal) fail(recipient.userId, new Error(refusal));
    return refusal === null;
  });

  await mapLimit(sendable, SHARE_CONCURRENCY, async (recipient) => {
    const conversation = opened.get(recipient.userId);
    if (!conversation) return;
    try {
      const message = await deps.sendMessage(conversation.id, {
        type: "VIDEO",
        videoId: run.videoId,
        ...(run.note.trim() ? { content: run.note.trim() } : {}),
        clientRequestId: requestKey(run.attemptId, recipient.userId),
      });
      results.set(recipient.userId, { ok: true, message });
    } catch (error) {
      fail(recipient.userId, error);
    }
  });
  return results;
}

function refusalOf(conversation: ConversationResponse): string | null {
  if (cannotMessage(conversation)) return "You can't message this account.";
  if (conversation.sendPermission === "REQUEST_SENT") return "Waiting for them to accept your request.";
  if (conversation.sendPermission === "AWAITING_ACCEPT") return "Accept their request to reply.";
  return null;
}

/** Viewer-facing reason for one recipient's failure, including the video-specific refusals. */
export function describeFailure(error: unknown): string {
  if (isApiError(error)) {
    switch (error.code) {
      case "VIDEO_NOT_AVAILABLE":
        return "This video isn't available.";
      case "VIDEO_NOT_SHAREABLE_TO_RECIPIENT":
        return "They can't view this video.";
      case "VIDEO_CHECK_UNAVAILABLE":
        return "Couldn't check the video. Try again in a moment.";
    }
    return chatErrorMessage(error);
  }
  return error instanceof Error ? error.message : chatErrorMessage(error);
}
