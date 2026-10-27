import { describe, expect, it } from "vitest";

import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import {
  EMPTY_UNREAD,
  addUnread,
  badgeLabel,
  loadUnread,
  markConversationReadLocally,
  needsTail,
  reconcile,
  saveUnread,
  unreadTail,
  unreadTotal,
} from "../chat-unread";

function msg(id: string, senderId: string, minute: number, conversationId = "c1"): MessageResponse {
  return {
    id,
    conversationId,
    senderId,
    type: "TEXT",
    content: id,
    stickerId: null,
    sticker: null,
    sentAt: new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString(),
    replyToMessageId: null,
    replyTo: null,
    recalledAt: null,
    reactions: [],
    revision: 0,
  };
}

function convo(id: string, hasUnread: boolean, lastMessageAt: string | null): ConversationResponse {
  return {
    id,
    participantIds: ["1", "2"],
    lastMessageContent: null,
    lastMessageType: null,
    lastMessageSenderId: null,
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

describe("badgeLabel", () => {
  it("hides at zero and caps at 99+", () => {
    expect(badgeLabel(0)).toBeUndefined();
    expect(badgeLabel(1)).toBe("1");
    expect(badgeLabel(99)).toBe("99");
    expect(badgeLabel(100)).toBe("99+");
  });
});

describe("addUnread", () => {
  it("counts a message once however often the frame is delivered", () => {
    let state = addUnread(EMPTY_UNREAD, msg("m1", "2", 1));
    state = addUnread(state, msg("m1", "2", 1));
    state = addUnread(state, msg("m2", "2", 2));
    state = addUnread(state, msg("m3", "2", 3, "c2"));
    expect(unreadTotal(state)).toBe(3);
  });
});

describe("markConversationReadLocally", () => {
  it("zeroes one thread, keeps the others and remembers the newest read time", () => {
    let state = addUnread(EMPTY_UNREAD, msg("m1", "2", 1));
    state = addUnread(state, msg("m3", "2", 3, "c2"));
    const read = markConversationReadLocally(state, "c1", msg("m1", "2", 5).sentAt);
    expect(unreadTotal(read)).toBe(1);
    expect(read.readThrough.c1).toBe(msg("m1", "2", 5).sentAt);

    const older = markConversationReadLocally(read, "c1", msg("m1", "2", 2).sentAt);
    expect(older.readThrough.c1).toBe(msg("m1", "2", 5).sentAt);
  });
});

describe("unreadTail", () => {
  it("stops at the viewer's own message and at the read mark", () => {
    const newestFirst = [msg("m5", "2", 5), msg("m4", "2", 4), msg("m3", "1", 3), msg("m2", "2", 2)];
    expect(unreadTail(newestFirst, "1", undefined).map((m) => m.id)).toEqual(["m5", "m4"]);
    expect(unreadTail(newestFirst, "1", msg("x", "2", 4).sentAt).map((m) => m.id)).toEqual(["m5"]);
  });
});

describe("reconcile", () => {
  const me = "1";

  it("counts the unread run of threads the server marks and drops the ones it calls read", () => {
    const start = markConversationReadLocally(
      addUnread(EMPTY_UNREAD, msg("old", "2", 1, "c2")),
      "c1",
      msg("x", "2", 2).sentAt,
    );
    const next = reconcile(
      start,
      [convo("c1", true, msg("m4", "2", 4).sentAt), convo("c2", false, msg("old", "2", 1).sentAt)],
      { c1: [msg("m4", "2", 4), msg("m3", "2", 3), msg("m2", "2", 2)] },
      me,
    );
    expect(next.unread.c1.ids).toEqual(["m3", "m4"]);
    expect(next.unread.c2).toBeUndefined();
    expect(unreadTotal(next)).toBe(2);
  });

  it("keeps the stored ids of a thread whose tail was not fetched", () => {
    const start = addUnread(EMPTY_UNREAD, msg("m1", "2", 1));
    const next = reconcile(start, [convo("c1", true, msg("m1", "2", 1).sentAt)], {}, me);
    expect(next.unread.c1.ids).toEqual(["m1"]);
  });
});

describe("needsTail", () => {
  it("fetches only unread threads whose stored ids are missing or stale", () => {
    const m = msg("m1", "2", 1);
    const state = addUnread(EMPTY_UNREAD, m);
    expect(needsTail(state, convo("c1", true, m.sentAt))).toBe(false);
    expect(needsTail(state, convo("c1", true, msg("m2", "2", 2).sentAt))).toBe(true);
    expect(needsTail(EMPTY_UNREAD, convo("c1", true, m.sentAt))).toBe(true);
    expect(needsTail(EMPTY_UNREAD, convo("c1", false, m.sentAt))).toBe(false);
  });
});

describe("storage", () => {
  it("round-trips per account", () => {
    const state = addUnread(EMPTY_UNREAD, msg("m1", "2", 1));
    saveUnread("1", state);
    expect(loadUnread("1")).toEqual(state);
    expect(loadUnread("2")).toEqual(EMPTY_UNREAD);
  });
});
