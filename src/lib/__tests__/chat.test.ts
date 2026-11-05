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
  comparePosition,
  formatSeenAgo,
  keepNewerBlock,
  mergeReceipt,
  messageStatus,
  statusTargets,
  sharedVideoIds,
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
    blockedByViewer: false,
    messagingBlocked: false,
    blockVersion: 0,
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

describe("keepNewerBlock", () => {
  const at = (version: number, blocked: boolean) =>
    ({ ...convo("c1", "2026-10-24T08:00:00.000Z", false), blockedByViewer: blocked, messagingBlocked: blocked, blockVersion: version }) as ConversationResponse;

  it("keeps the newer block state when an older answer arrives late", () => {
    const merged = keepNewerBlock(at(7, true), at(6, false));
    expect(merged.blockedByViewer).toBe(true);
    expect(merged.blockVersion).toBe(7);
  });

  it("takes a newer or equal answer, and anything when nothing is known", () => {
    expect(keepNewerBlock(at(7, true), at(8, false)).blockedByViewer).toBe(false);
    expect(keepNewerBlock(at(7, true), at(7, false)).blockedByViewer).toBe(false);
    expect(keepNewerBlock(undefined, at(1, true)).blockedByViewer).toBe(true);
  });

  it("placeConversation does not let a stale event undo a newer block", () => {
    const lists = { inbox: [at(9, true)], requests: [] };
    const placed = placeConversation(lists, at(8, false), "1");
    expect(placed.inbox[0].blockedByViewer).toBe(true);
  });
});

describe("sharedVideoIds", () => {
  const video = (id: string, minute: number, videoId: string, over: Partial<MessageResponse> = {}): MessageResponse =>
    ({
      id,
      conversationId: "c",
      senderId: "2",
      type: "VIDEO",
      content: null,
      sentAt: new Date(Date.UTC(2026, 9, 28, 8, minute)).toISOString(),
      recalledAt: null,
      video: { videoId, state: "AVAILABLE", ownerId: null, thumbnailUrl: null, title: null, durationSeconds: null },
      ...over,
    }) as MessageResponse;

  it("lists the shares oldest first whichever order they are given in", () => {
    const shares = [video("m3", 30, "v3"), video("m1", 10, "v1"), video("m2", 20, "v2")];
    expect(sharedVideoIds(shares)).toEqual(["v1", "v2", "v3"]);
    expect(sharedVideoIds([...shares].reverse())).toEqual(["v1", "v2", "v3"]);
  });

  it("ignores text, recalled shares and videos that cannot be opened", () => {
    const list = [
      video("a", 1, "v1"),
      { ...video("b", 2, "x"), type: "TEXT", video: null } as MessageResponse,
      video("c", 3, "v3", { recalledAt: "2026-10-28T09:00:00.000Z" }),
      video("d", 4, "v4", { video: { videoId: "v4", state: "UNKNOWN", ownerId: null, thumbnailUrl: null, title: null, durationSeconds: null } }),
    ];
    expect(sharedVideoIds(list)).toEqual(["v1"]);
  });

  it("keeps the first share of a video shared twice, and is empty with none", () => {
    expect(sharedVideoIds([video("a", 1, "v1"), video("b", 2, "v2"), video("c", 3, "v1")])).toEqual(["v1", "v2"]);
    expect(sharedVideoIds([])).toEqual([]);
  });
});

describe("message status", () => {
  const T = Date.UTC(2026, 9, 28, 8, 0, 0);
  const sec = (s: number) => new Date(T + s * 1000).toISOString();
  const m = (id: string, s: number, senderId = "1", recalledAt: string | null = null) =>
    ({ id, senderId, sentAt: sec(s), recalledAt }) as MessageResponse;
  const mark = (messageId: string, s: number, at = 100) => ({ messageId, sentAt: sec(s), at: sec(at) });
  const receipt = (delivered: ReturnType<typeof mark> | null, read: ReturnType<typeof mark> | null = null) => ({
    userId: "2",
    delivered,
    read,
  });

  describe("comparePosition", () => {
    it("orders by time, then by id for messages sent in the same moment", () => {
      expect(comparePosition(mark("5", 1), mark("5", 2))).toBeLessThan(0);
      expect(comparePosition(mark("200", 1), mark("100", 1))).toBeGreaterThan(0);
      expect(comparePosition(mark("100", 1), mark("100", 1))).toBe(0);
    });

    it("compares 18-digit ids as numbers without ever turning them into one", () => {
      const a = mark("372385859884797952", 1);
      const b = mark("372385859884797953", 1);
      expect(comparePosition(a, b)).toBeLessThan(0);
      expect(comparePosition(mark("99", 1), mark("100", 1))).toBeLessThan(0);
    });
  });

  describe("messageStatus", () => {
    it("is Sent until the other side reports, and when nothing is known of them", () => {
      expect(messageStatus(m("m1", 1), null)).toBe("SENT");
      expect(messageStatus(m("m1", 1), receipt(null))).toBe("SENT");
    });

    it("is decided by position: received once the delivered mark reaches it, seen once the read mark does", () => {
      expect(messageStatus(m("m1", 1), receipt(mark("m1", 1)))).toBe("DELIVERED");
      expect(messageStatus(m("m1", 1), receipt(mark("m2", 2)))).toBe("DELIVERED");
      expect(messageStatus(m("m1", 1), receipt(mark("m2", 2), mark("m1", 1)))).toBe("SEEN");
      expect(messageStatus(m("m1", 1), receipt(null, mark("m2", 2)))).toBe("SEEN");
    });

    it("a message sent after the mark is Sent, however recently the mark was recorded", () => {
      // The mark names m1 and was recorded long after m2 was sent: m2 is not covered.
      const r = receipt(mark("m1", 1, 500), mark("m1", 1, 500));
      expect(messageStatus(m("m1", 1), r)).toBe("SEEN");
      expect(messageStatus(m("m2", 2), r)).toBe("SENT");
    });

    it("tells two messages of the same moment apart by id", () => {
      const r = receipt(mark("100", 5), mark("100", 5));
      expect(messageStatus(m("100", 5), r)).toBe("SEEN");
      expect(messageStatus(m("101", 5), r)).toBe("SENT");
    });
  });

  describe("mergeReceipt", () => {
    it("takes the later position of each mark, so nothing goes back", () => {
      const merged = mergeReceipt(receipt(mark("m5", 5), mark("m5", 5)), receipt(mark("m2", 2), null));
      expect(merged.delivered?.messageId).toBe("m5");
      expect(merged.read?.messageId).toBe("m5");
    });

    it("a repeat of the same position keeps the time it was first recorded", () => {
      const merged = mergeReceipt(receipt(mark("m5", 5, 100), mark("m5", 5, 100)), receipt(mark("m5", 5, 900), mark("m5", 5, 900)));
      expect(merged.read?.at).toBe(sec(100));
    });

    it("seeing implies receiving: delivered is never left behind read", () => {
      const merged = mergeReceipt(null, receipt(mark("m1", 1), mark("m3", 3)));
      expect(merged.delivered?.messageId).toBe("m3");
    });

    it("a later position replaces it, with its own time", () => {
      const merged = mergeReceipt(receipt(null, mark("m1", 1, 100)), receipt(null, mark("m3", 3, 300)));
      expect(merged.read).toEqual(mark("m3", 3, 300));
    });
  });

  describe("statusTargets", () => {
    it("the newest seen message keeps Seen, and a newer one that is not seen says Sent", () => {
      // Like the reference: "seen 13 minutes ago" under an earlier message, a newer one unseen.
      const list = [m("a", 1), m("b", 2), m("c", 3)];
      const t = statusTargets(list, "1", receipt(mark("b", 2), mark("b", 2)));
      expect(t).toEqual({ seenId: "b", latestId: "c", latestStatus: "SENT" });
    });

    it("says Received on the newest when the other side has it but has not looked", () => {
      const list = [m("a", 1), m("b", 2)];
      expect(statusTargets(list, "1", receipt(mark("b", 2), mark("a", 1)))).toEqual({
        seenId: "a",
        latestId: "b",
        latestStatus: "DELIVERED",
      });
    });

    it("when the newest is the seen one there is a single label", () => {
      const list = [m("a", 1), m("b", 2)];
      expect(statusTargets(list, "1", receipt(mark("b", 2), mark("b", 2)))).toEqual({
        seenId: "b",
        latestId: null,
        latestStatus: null,
      });
    });

    it("the label moves to the newer message when the read mark advances", () => {
      const list = [m("a", 1), m("b", 2), m("c", 3)];
      expect(statusTargets(list, "1", receipt(mark("a", 1), mark("a", 1))).seenId).toBe("a");
      expect(statusTargets(list, "1", receipt(mark("c", 3), mark("c", 3))).seenId).toBe("c");
    });

    it("skips the other side's messages and recalled ones, and settles on what still stands", () => {
      const list = [m("a", 1), m("x", 2, "2"), m("b", 3, "1", sec(9))];
      const t = statusTargets(list, "1", receipt(mark("b", 3), mark("b", 3)));
      expect(t.seenId).toBe("a");
      expect(t.latestId).toBeNull();
    });

    it("is empty when the viewer has sent nothing, whatever the order of the list", () => {
      expect(statusTargets([m("x", 1, "2")], "1", null)).toEqual({ seenId: null, latestId: null, latestStatus: null });
      const t = statusTargets([m("c", 3), m("a", 1)], "1", null);
      expect(t.latestId).toBe("c");
    });
  });

  describe("formatSeenAgo", () => {
    const at = sec(0);
    const after = (seconds: number) => Date.parse(at) + seconds * 1000;

    it("is Seen just now for the first minute, then minutes, hours and days", () => {
      expect(formatSeenAgo(at, after(0))).toBe("Seen just now");
      expect(formatSeenAgo(at, after(59))).toBe("Seen just now");
      expect(formatSeenAgo(at, after(60))).toBe("Seen 1 min ago");
      expect(formatSeenAgo(at, after(13 * 60 + 5))).toBe("Seen 13 min ago");
      expect(formatSeenAgo(at, after(3600))).toBe("Seen 1 hr ago");
      expect(formatSeenAgo(at, after(5 * 3600))).toBe("Seen 5 hr ago");
      expect(formatSeenAgo(at, after(2 * 86400 + 10))).toBe("Seen 2 d ago");
    });

    it("never invents a time: with none, or an unreadable one, it says only Seen", () => {
      expect(formatSeenAgo(null, after(100))).toBe("Seen");
      expect(formatSeenAgo(undefined, after(100))).toBe("Seen");
      expect(formatSeenAgo("not a time", after(100))).toBe("Seen");
    });

    it("a clock a little behind the server's does not make a negative time", () => {
      expect(formatSeenAgo(at, after(-30))).toBe("Seen just now");
    });
  });
});
