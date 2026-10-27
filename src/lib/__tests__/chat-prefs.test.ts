import { describe, expect, it } from "vitest";

import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { EMPTY_UNREAD, addUnread, dropConversation, unreadTotal } from "@/lib/chat-unread";
import {
  applyIncoming,
  isMuted,
  nextMuteExpiry,
  noticeBody,
  placeConversation,
  sortConversations,
} from "@/lib/chat";
import { EMPTY_DOCK, dockConversations, openThread } from "@/lib/floating-chat";

function convo(id: string, over: Partial<ConversationResponse> = {}): ConversationResponse {
  return {
    id,
    participantIds: ["1", `p${id}`],
    lastMessageContent: "x",
    lastMessageType: "TEXT",
    lastMessageSenderId: "2",
    lastMessageAt: "2026-10-27T08:00:00.000Z",
    createdAt: null,
    hasUnread: false,
    requestState: null,
    initiatorId: null,
    sendPermission: "ALLOWED",
    retryAvailableAt: null,
    lastMessageRecalled: false,
    pinnedAt: null,
    muteMode: "NONE",
    mutedUntil: null,
    inboxHidden: false,
    ...over,
  };
}

const at = (minute: number) => new Date(Date.UTC(2026, 9, 27, 8, minute)).toISOString();
const ids = (list: readonly ConversationResponse[]) => list.map((c) => c.id);

describe("sortConversations", () => {
  it("puts pinned first with the latest pin on top, then unpinned by activity", () => {
    const list = [
      convo("a", { pinnedAt: at(1), lastMessageAt: at(50) }),
      convo("b", { pinnedAt: at(3), lastMessageAt: at(10) }),
      convo("c", { pinnedAt: at(2), lastMessageAt: at(20) }),
      convo("d", { lastMessageAt: at(40) }),
      convo("e", { lastMessageAt: at(45) }),
    ];
    expect(ids(sortConversations(list))).toEqual(["b", "c", "a", "e", "d"]);
  });

  it("a new message in a pinned chat moves nothing, while an unpinned one rises", () => {
    const list = sortConversations([
      convo("pin", { pinnedAt: at(1), lastMessageAt: at(5) }),
      convo("old", { lastMessageAt: at(6) }),
      convo("new", { lastMessageAt: at(7) }),
    ]);
    const message = { id: "m", conversationId: "pin", senderId: "2", type: "TEXT", content: "hi", sentAt: at(30) } as MessageResponse;
    expect(ids(applyIncoming(list, message, "1", null))).toEqual(["pin", "new", "old"]);

    const other = { ...message, conversationId: "old" };
    expect(ids(applyIncoming(list, other, "1", null))).toEqual(["pin", "old", "new"]);
  });

  it("breaks every tie by id, so the same data always gives the same list", () => {
    const same = [convo("1", { lastMessageAt: at(5) }), convo("3", { lastMessageAt: at(5) }), convo("2", { lastMessageAt: at(5) })];
    expect(ids(sortConversations(same))).toEqual(["3", "2", "1"]);
    expect(ids(sortConversations([...same].reverse()))).toEqual(["3", "2", "1"]);
  });

  it("a conversation with no messages sorts after the ones with messages", () => {
    expect(ids(sortConversations([convo("a", { lastMessageAt: null }), convo("b")]))).toEqual(["b", "a"]);
  });
});

describe("placeConversation with the viewer's choices", () => {
  const me = "1";

  it("keeps the pinned order when a pin arrives from the server", () => {
    const lists = { inbox: [convo("a", { pinnedAt: at(1) }), convo("b")], requests: [] };
    const next = placeConversation(lists, convo("b", { pinnedAt: at(2) }), me);
    expect(ids(next.inbox)).toEqual(["b", "a"]);
  });

  it("drops a conversation the viewer deleted and nothing newer has arrived", () => {
    const lists = { inbox: [convo("a"), convo("b")], requests: [] };
    expect(ids(placeConversation(lists, convo("a", { inboxHidden: true }), me).inbox)).toEqual(["b"]);
  });

  it("puts it back once it is visible again", () => {
    const lists = { inbox: [convo("b")], requests: [] };
    expect(ids(placeConversation(lists, convo("a", { inboxHidden: false }), me).inbox)).toContain("a");
  });
});

describe("mute", () => {
  const now = Date.parse(at(30));

  it("is in force for indefinite and for a timed mute that has not ended", () => {
    expect(isMuted(convo("a", { muteMode: "INDEFINITE" }), now)).toBe(true);
    expect(isMuted(convo("a", { muteMode: "TIMED", mutedUntil: at(31) }), now)).toBe(true);
  });

  it("is over at its end, with the list still saying TIMED", () => {
    expect(isMuted(convo("a", { muteMode: "TIMED", mutedUntil: at(30) }), now)).toBe(false);
    expect(isMuted(convo("a", { muteMode: "TIMED", mutedUntil: at(29) }), now)).toBe(false);
    expect(isMuted(convo("a"), now)).toBe(false);
  });

  it("finds the soonest end still ahead, ignoring finished and indefinite ones", () => {
    const list = [
      convo("a", { muteMode: "TIMED", mutedUntil: at(90) }),
      convo("b", { muteMode: "TIMED", mutedUntil: at(40) }),
      convo("c", { muteMode: "TIMED", mutedUntil: at(10) }),
      convo("d", { muteMode: "INDEFINITE" }),
    ];
    expect(nextMuteExpiry(list, now)).toBe(Date.parse(at(40)));
    expect(nextMuteExpiry([convo("x")], now)).toBeNull();
  });

  it("describes a message for a notification without leaking a recalled one", () => {
    expect(noticeBody({ type: "TEXT", content: "  hello\n there ", recalledAt: null })).toBe("hello there");
    expect(noticeBody({ type: "STICKER", content: null, recalledAt: null })).toBe("Sent a sticker");
    expect(noticeBody({ type: "TEXT", content: "secret", recalledAt: at(1) })).toBe("Sent a message");
    expect(noticeBody({ type: "TEXT", content: "x".repeat(300), recalledAt: null }).length).toBe(120);
  });
});

describe("the floating dock and mute", () => {
  const unread = { a: 2, b: 1 };

  it("raises no bubble for a muted conversation, however many are unread", () => {
    const list = [convo("a", { muteMode: "INDEFINITE" }), convo("b")];
    const shown = dockConversations(list, unread, EMPTY_DOCK, (c) => isMuted(c, 0));
    expect(ids(shown)).toEqual(["b"]);
  });

  it("keeps one the viewer opened, muted or not", () => {
    const list = [convo("a", { muteMode: "INDEFINITE" })];
    const shown = dockConversations(list, unread, openThread(EMPTY_DOCK, "a"), (c) => isMuted(c, 0));
    expect(ids(shown)).toEqual(["a"]);
  });

  it("brings the bubble back for unread messages once the mute has ended", () => {
    const list = [convo("a", { muteMode: "TIMED", mutedUntil: at(10) })];
    const during = dockConversations(list, unread, EMPTY_DOCK, (c) => isMuted(c, Date.parse(at(5))));
    const after = dockConversations(list, unread, EMPTY_DOCK, (c) => isMuted(c, Date.parse(at(11))));
    expect(ids(during)).toEqual([]);
    expect(ids(after)).toEqual(["a"]);
  });
});

describe("dropConversation", () => {
  it("removes its unread run and read mark and leaves the others", () => {
    const message = (id: string, conversationId: string) =>
      ({ id, conversationId, senderId: "2", sentAt: at(1) }) as MessageResponse;
    let state = addUnread(EMPTY_UNREAD, message("1", "a"));
    state = addUnread(state, message("2", "b"));
    state = { ...state, readThrough: { a: at(1), b: at(1) } };

    const next = dropConversation(state, "a");

    expect(unreadTotal(next)).toBe(1);
    expect(next.unread.a).toBeUndefined();
    expect(next.readThrough).toEqual({ b: at(1) });
  });
});
