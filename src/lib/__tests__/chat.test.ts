import { describe, expect, it } from "vitest";

import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";
import {
  MAX_MESSAGE_LENGTH,
  applyIncoming,
  buildThread,
  chatErrorMessage,
  isDeletedByViewer,
  isIncomingRequest,
  isPermissionChange,
  isSendable,
  messagePreview,
  isThreadLocked,
  placeConversation,
  requestCounts,
  retryAvailableAfter,
  mergeMessages,
  otherParticipantId,
} from "../chat";

function msg(id: string, senderId: string, sentAt: string, conversationId = "c1"): MessageResponse {
  return { id, conversationId, senderId, type: "TEXT", content: `m${id}`, stickerId: null, sticker: null, sentAt, replyToMessageId: null, replyTo: null, recalledAt: null, reactions: [], revision: 0 };
}

function convo(id: string, lastMessageAt: string | null, hasUnread = false): ConversationResponse {
  return {
    id,
    participantIds: ["1", "2"],
    lastMessageContent: "old",
    lastMessageType: null,
    lastMessageSenderId: "2",
    lastMessageAt,
    createdAt: null,
    hasUnread,
    requestState: null,
    initiatorId: null,
    sendPermission: "ALLOWED",
    retryAvailableAt: null,
    lastMessageRecalled: false,
    pinnedAt: null,
    muteMode: "NONE",
    mutedUntil: null,
    inboxHidden: false,
  };
}

describe("isSendable", () => {
  it("rejects blank and over-long text", () => {
    expect(isSendable("   \n")).toBe(false);
    expect(isSendable("hi")).toBe(true);
    expect(isSendable("x".repeat(MAX_MESSAGE_LENGTH))).toBe(true);
    expect(isSendable("x".repeat(MAX_MESSAGE_LENGTH + 1))).toBe(false);
  });
});

describe("mergeMessages", () => {
  it("dedupes by id and sorts oldest first, comparing ids numerically on a tie", () => {
    const a = msg("346173853382643712", "1", "2026-10-24T08:00:00Z");
    const b = msg("346173853382643713", "2", "2026-10-24T08:00:00Z");
    const earlier = msg("9", "1", "2026-10-24T07:00:00Z");
    const merged = mergeMessages([b, a], [a, earlier]);
    expect(merged.map((m) => m.id)).toEqual(["9", a.id, b.id]);
  });
});

describe("applyIncoming", () => {
  const me = "1";

  it("updates the preview, flags unread and moves the row to the top", () => {
    const list = [convo("c0", "2026-10-24T08:00:00Z"), convo("c1", "2026-10-24T07:00:00Z")];
    const next = applyIncoming(list, msg("5", "2", "2026-10-24T09:00:00Z"), me, null);
    expect(next.map((c) => c.id)).toEqual(["c1", "c0"]);
    expect(next[0]).toMatchObject({ lastMessageContent: "m5", hasUnread: true });
  });

  it("does not flag the open thread or the viewer's own messages", () => {
    const list = [convo("c1", "2026-10-24T07:00:00Z")];
    expect(applyIncoming(list, msg("5", "2", "2026-10-24T09:00:00Z"), me, "c1")[0].hasUnread).toBe(false);
    expect(applyIncoming(list, msg("6", "1", "2026-10-24T09:00:00Z"), me, null)[0].hasUnread).toBe(false);
  });

  it("keeps the preview of a newer message when an older one arrives late", () => {
    const list = [convo("c1", "2026-10-24T09:00:00Z")];
    const next = applyIncoming(list, msg("5", "2", "2026-10-24T08:00:00Z"), me, null);
    expect(next[0].lastMessageContent).toBe("old");
  });
});

describe("buildThread", () => {
  const now = new Date(2026, 9, 24, 12, 0);

  it("inserts a day divider and marks the ends of a run", () => {
    const items = buildThread(
      [
        msg("1", "2", new Date(2026, 9, 23, 22, 0).toISOString()),
        msg("2", "2", new Date(2026, 9, 24, 9, 0).toISOString()),
        msg("3", "2", new Date(2026, 9, 24, 9, 1).toISOString()),
        msg("4", "1", new Date(2026, 9, 24, 9, 2).toISOString()),
      ],
      "1",
      now,
    );
    expect(items.map((i) => (i.kind === "day" ? i.label : i.key))).toEqual([
      "Yesterday",
      "1",
      "Today",
      "2",
      "3",
      "4",
    ]);
    const flags = items
      .filter((i) => i.kind === "message")
      .map((i) => (i.kind === "message" ? [i.startsRun, i.endsRun, i.mine] : []));
    expect(flags).toEqual([
      [true, true, false],
      [true, false, false],
      [false, true, false],
      [true, true, true],
    ]);
  });
});

describe("errors", () => {
  it("locks the thread only for permanent refusals", () => {
    expect(isThreadLocked(new ApiError(403, "MESSAGING_BLOCKED", ""))).toBe(true);
    expect(isThreadLocked(new ApiError(503, "BLOCK_CHECK_UNAVAILABLE", ""))).toBe(false);
    expect(isThreadLocked(new Error("x"))).toBe(false);
  });

  it("words network and unknown failures", () => {
    expect(chatErrorMessage(new ApiError(0, "NETWORK_ERROR", ""))).toMatch(/connection/);
    expect(chatErrorMessage(new Error("x"))).toMatch(/Something went wrong/);
  });

  it("picks the other participant", () => {
    expect(otherParticipantId(convo("c1", null), "1")).toBe("2");
  });
});

describe("message requests", () => {
  const me = "1";
  const request = (over: Partial<ConversationResponse> = {}): ConversationResponse => ({
    ...convo("r1", null),
    lastMessageAt: "2026-10-26T12:00:00.000Z",
    lastMessageContent: "hello",
    lastMessageType: null,
    lastMessageSenderId: "2",
    hasUnread: true,
    requestState: "PENDING",
    initiatorId: "2",
    sendPermission: "AWAITING_ACCEPT",
    ...over,
  });

  it("tells a request waiting on the viewer from one they opened and from a deleted one", () => {
    expect(isIncomingRequest(request(), me)).toBe(true);
    expect(isIncomingRequest(request({ initiatorId: "1", sendPermission: "REQUEST_SENT" }), me)).toBe(false);
    expect(isIncomingRequest(request({ requestState: null, initiatorId: null }), me)).toBe(false);
    expect(isDeletedByViewer(request({ requestState: "DECLINED" }), me)).toBe(true);
    expect(isDeletedByViewer(request({ requestState: "DECLINED", initiatorId: "1" }), me)).toBe(false);
  });

  it("puts an arriving request in the box, never in the inbox", () => {
    const lists = placeConversation({ inbox: [convo("c1", "2026-10-26T08:00:00.000Z")], requests: [] }, request(), me);
    expect(lists.requests.map((c) => c.id)).toEqual(["r1"]);
    expect(lists.inbox.map((c) => c.id)).toEqual(["c1"]);
  });

  it("moves an accepted request to the inbox, so it counts once and in one place", () => {
    const start = { inbox: [], requests: [request()] };
    const accepted = request({ requestState: null, sendPermission: "ALLOWED", hasUnread: false });
    const lists = placeConversation(start, accepted, me);
    expect(lists.requests).toEqual([]);
    expect(lists.inbox.map((c) => c.id)).toEqual(["r1"]);
  });

  it("removes a request the viewer deleted from both lists", () => {
    const start = { inbox: [], requests: [request()] };
    const lists = placeConversation(start, request({ requestState: "DECLINED", sendPermission: "REOPEN_ON_SEND" }), me);
    expect(lists).toEqual({ inbox: [], requests: [] });
  });

  it("keeps the sender's own pending request in their inbox, where they can still open it", () => {
    const mine = request({ initiatorId: "1", lastMessageSenderId: "1", sendPermission: "REQUEST_SENT", hasUnread: false });
    const lists = placeConversation({ inbox: [], requests: [] }, mine, me);
    expect(lists.inbox.map((c) => c.id)).toEqual(["r1"]);
    expect(lists.requests).toEqual([]);
  });

  it("does not show a request that has no message yet", () => {
    const lists = placeConversation({ inbox: [], requests: [] }, request({ lastMessageAt: null }), me);
    expect(lists.requests).toEqual([]);
  });

  it("counts pending and unread requests as different numbers", () => {
    const counts = requestCounts([request(), request({ id: "r2", hasUnread: false }), request({ id: "r3" })]);
    expect(counts).toEqual({ pending: 3, unread: 2 });
  });

  it("asks the server again when a refusal says the permission changed", () => {
    expect(isPermissionChange(new ApiError(403, "MESSAGE_REQUEST_LIMIT_REACHED", ""))).toBe(true);
    expect(isPermissionChange(new ApiError(409, "MESSAGE_REQUEST_NOT_PENDING", ""))).toBe(true);
    expect(isPermissionChange(new ApiError(403, "MESSAGING_BLOCKED", ""))).toBe(false);
    expect(chatErrorMessage(new ApiError(403, "MESSAGE_REQUEST_NOT_ACCEPTED", ""))).toMatch(/Accept/);
  });
});

describe("request retry window", () => {
  it("opens fifteen days after the request message", () => {
    expect(retryAvailableAfter("2026-10-01T09:00:00.000Z")).toBe("2026-10-16T09:00:00.000Z");
  });
});

describe("sticker previews", () => {
  const stickerMessage = (over: Partial<MessageResponse> = {}): MessageResponse => ({
    ...msg("5", "2", "2026-10-27T09:00:00.000Z"),
    type: "STICKER",
    content: null,
    stickerId: "fire",
    sticker: { stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 },
    ...over,
  });

  it("says a sticker was sent, from either side", () => {
    const base = { lastMessageContent: null, lastMessageType: "STICKER" as const };
    expect(messagePreview({ ...base, lastMessageSenderId: "2" }, "1")).toBe("Sent a sticker");
    expect(messagePreview({ ...base, lastMessageSenderId: "1" }, "1")).toBe("You sent a sticker");
  });

  it("keeps the text preview and the empty one as they were", () => {
    expect(messagePreview({ lastMessageContent: "hi", lastMessageType: "TEXT", lastMessageSenderId: "2" }, "1")).toBe("hi");
    expect(messagePreview({ lastMessageContent: "hi", lastMessageType: "TEXT", lastMessageSenderId: "1" }, "1")).toBe("You: hi");
    expect(messagePreview({ lastMessageContent: null, lastMessageType: null, lastMessageSenderId: null }, "1")).toBe("No messages yet");
  });

  /** What the socket delivers and what a reload returns must read the same. */
  it("gives the live preview the same words the reloaded one has", () => {
    const list = [{ ...convo("c1", "2026-10-27T08:00:00.000Z"), lastMessageContent: "before", lastMessageType: "TEXT" as const }];
    const live = applyIncoming(list, stickerMessage(), "1", null)[0];
    const reloaded = {
      ...list[0],
      lastMessageContent: null,
      lastMessageType: "STICKER" as const,
      lastMessageSenderId: "2",
      lastMessageAt: "2026-10-27T09:00:00.000Z",
    };

    expect(live.lastMessageType).toBe("STICKER");
    expect(live.lastMessageContent).toBeNull();
    expect(messagePreview(live, "1")).toBe(messagePreview(reloaded, "1"));
  });

  it("shows a sticker once when the same message arrives over REST and the socket", () => {
    const sticker = stickerMessage();
    const merged = mergeMessages(mergeMessages([], [sticker]), [{ ...sticker }]);
    expect(merged).toHaveLength(1);
    expect(merged[0].type).toBe("STICKER");
  });
});
