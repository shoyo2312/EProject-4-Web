import { describe, expect, it } from "vitest";

import type { ConversationResponse } from "@/lib/api/conversations";
import {
  EMPTY_DOCK,
  closeThread,
  dockConversations,
  minimizeThread,
  MAX_BUBBLES,
  openThread,
  splitDock,
  toggleThread,
} from "../floating-chat";

function convo(id: string, minute: number): ConversationResponse {
  return {
    id,
    participantIds: ["1", id],
    lastMessageContent: null,
    lastMessageType: null,
    lastMessageSenderId: null,
    lastMessageAt: new Date(Date.UTC(2026, 9, 24, 8, minute)).toISOString(),
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
    blockedByViewer: false,
    messagingBlocked: false,
    blockVersion: 0,
  };
}

const list = [convo("a", 5), convo("b", 4), convo("c", 3)];

describe("dockConversations", () => {
  it("shows conversations with unread messages, newest first, and nothing else", () => {
    expect(dockConversations(list, { b: 2, c: 1 }, EMPTY_DOCK).map((c) => c.id)).toEqual(["b", "c"]);
    expect(dockConversations(list, {}, EMPTY_DOCK)).toEqual([]);
  });

  it("keeps an opened thread after it is minimised and read", () => {
    let dock = openThread(EMPTY_DOCK, "c");
    expect(dock.expandedId).toBe("c");
    dock = minimizeThread(dock);
    expect(dock.expandedId).toBeNull();
    expect(dockConversations(list, {}, dock).map((c) => c.id)).toEqual(["c"]);
  });

  it("hides a closed thread until a newer message arrives", () => {
    const closed = closeThread(openThread(EMPTY_DOCK, "b"), "b", list[1].lastMessageAt);
    expect(closed.expandedId).toBeNull();
    expect(dockConversations(list, { b: 3 }, closed)).toEqual([]);

    const newer = [convo("b", 9), ...list.filter((c) => c.id !== "b")];
    expect(dockConversations(newer, { b: 4 }, closed).map((c) => c.id)).toEqual(["b"]);
  });

  it("opening a closed thread clears its dismissal", () => {
    const closed = closeThread(EMPTY_DOCK, "b", list[1].lastMessageAt);
    expect(openThread(closed, "b").dismissed).toEqual({});
  });
});

const ids = (items: readonly ConversationResponse[]) => items.map((c) => c.id);
const allUnread = (...names: string[]) => Object.fromEntries(names.map((n) => [n, 1]));

describe("dockConversations ordering", () => {
  it("shows one bubble for one unread conversation and two for two", () => {
    expect(ids(dockConversations(list, allUnread("c"), EMPTY_DOCK))).toEqual(["c"]);
    expect(ids(dockConversations(list, allUnread("a", "c"), EMPTY_DOCK))).toEqual(["a", "c"]);
  });

  it("never pads the dock with recent conversations that are not unread or opened", () => {
    const many = ["a", "b", "c", "d", "e"].map((id, i) => convo(id, 10 - i));
    expect(ids(dockConversations(many, allUnread("e"), EMPTY_DOCK))).toEqual(["e"]);
  });

  it("orders by the newest message whatever order the inbox list is in, without touching it", () => {
    // The inbox keeps a pinned chat on top even though it is the oldest.
    const inbox = [convo("pinned", 1), convo("x", 9), convo("y", 5)];
    const copy = [...inbox];
    const shown = dockConversations(inbox, allUnread("pinned", "x", "y"), EMPTY_DOCK);
    expect(ids(shown)).toEqual(["x", "y", "pinned"]);
    expect(inbox).toEqual(copy);
    expect(shown).not.toBe(inbox);
  });

  it("breaks a tie by id, so the dock does not flicker between renders", () => {
    const tied = [convo("1", 5), convo("3", 5), convo("2", 5)];
    expect(ids(dockConversations(tied, allUnread("1", "2", "3"), EMPTY_DOCK))).toEqual(["3", "2", "1"]);
  });
});

describe("toggleThread", () => {
  it("opens a conversation, minimises it on the second press, and switches on another", () => {
    const opened = toggleThread(EMPTY_DOCK, "a");
    expect(opened.expandedId).toBe("a");
    expect(toggleThread(opened, "b").expandedId).toBe("b");
    const minimised = toggleThread(opened, "a");
    expect(minimised.expandedId).toBeNull();
    expect(minimised.pinned).toEqual(["a"]);
    expect(minimised.dismissed).toEqual({});
  });
});

describe("splitDock", () => {
  const five = ["a", "b", "c", "d", "e"].map((id, i) => convo(id, 50 - i));

  it("shows at most three bubbles and counts the rest", () => {
    expect(MAX_BUBBLES).toBe(3);
    const { shown, hidden, expanded } = splitDock(five, null);
    expect(ids(shown)).toEqual(["a", "b", "c"]);
    expect(hidden).toBe(2);
    expect(expanded).toBeUndefined();
  });

  it("shows exactly as many as there are below three, with no +N", () => {
    expect(splitDock(five.slice(0, 1), null)).toMatchObject({ hidden: 0 });
    expect(ids(splitDock(five.slice(0, 2), null).shown)).toEqual(["a", "b"]);
  });

  it("the open conversation keeps its bubble and takes one of the three places", () => {
    const { shown, expanded, hidden } = splitDock(five, "b");
    expect(expanded?.id).toBe("b");
    expect(ids(shown)).toEqual(["a", "b", "c"]);
    expect(hidden).toBe(2);
  });

  it("an open conversation outside the newest three takes the last place; none is counted twice", () => {
    const { shown, hidden } = splitDock(five, "e");
    expect(ids(shown)).toEqual(["a", "b", "e"]);
    expect(hidden).toBe(2);
    expect(shown.length + hidden).toBe(five.length);
  });

  it("a conversation outside the three comes in at its place when a newer message arrives", () => {
    const unread = allUnread("a", "b", "c", "d");
    const before = dockConversations([convo("a", 40), convo("b", 30), convo("c", 20), convo("d", 10)], unread, EMPTY_DOCK);
    expect(ids(splitDock(before, null).shown)).toEqual(["a", "b", "c"]);

    const after = dockConversations([convo("a", 40), convo("b", 30), convo("c", 20), convo("d", 55)], unread, EMPTY_DOCK);
    expect(ids(splitDock(after, null).shown)).toEqual(["d", "a", "b"]);
    expect(splitDock(after, null).hidden).toBe(1);
  });
});
