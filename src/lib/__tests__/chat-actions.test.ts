import { describe, expect, it } from "vitest";

import type { MessageResponse, ReplyQuote } from "@/lib/api/conversations";
import {
  REACTION_EMOJIS,
  applyUpdate,
  canReplyTo,
  groupReactions,
  mergeMessages,
  messagePreview,
  myReaction,
  quoteText,
  reconcileWindow,
  removeMessage,
} from "@/lib/chat";

function msg(id: string, over: Partial<MessageResponse> = {}): MessageResponse {
  return {
    id,
    conversationId: "c1",
    senderId: "2",
    type: "TEXT",
    content: `m${id}`,
    stickerId: null,
    sticker: null,
    sentAt: new Date(Date.UTC(2026, 9, 27, 8, Number(id))).toISOString(),
    replyToMessageId: null,
    replyTo: null,
    recalledAt: null,
    reactions: [],
    revision: 0,
    ...over,
  };
}

const quote = (messageId: string): ReplyQuote => ({
  messageId,
  state: "OK",
  senderId: "2",
  type: "TEXT",
  content: "original",
  sticker: null,
});

const update = (messageId: string, over: Partial<Parameters<typeof applyUpdate>[1]> = {}) => ({
  messageId,
  conversationId: "c1",
  revision: 1,
  recalledAt: null,
  reactions: [],
  ...over,
});

describe("mergeMessages revisions", () => {
  it("does not let an older copy overwrite a newer one", () => {
    const recalled = msg("1", { content: null, recalledAt: "2026-10-27T09:00:00Z", revision: 2 });
    expect(mergeMessages([recalled], [msg("1", { revision: 0 })])[0].content).toBeNull();
  });

  it("takes an equal or newer copy", () => {
    expect(mergeMessages([msg("1")], [msg("1", { revision: 3, content: "x" })])[0].content).toBe("x");
  });
});

describe("applyUpdate", () => {
  it("sets reactions and the revision", () => {
    const [next] = applyUpdate([msg("1")], update("1", { reactions: [{ userId: "1", emoji: "\u{1F44D}" }] }));
    expect(next.reactions).toHaveLength(1);
    expect(next.revision).toBe(1);
  });

  it("ignores an update older than what is held and one for an unknown message", () => {
    const held = [msg("1", { revision: 5, reactions: [{ userId: "1", emoji: "\u{1F44D}" }] })];
    expect(applyUpdate(held, update("1", { revision: 4 }))).toEqual(held);
    expect(applyUpdate(held, update("9"))).toEqual(held);
  });

  it("a recall drops content, sticker and reactions and blanks quotes of it in replies", () => {
    const original = msg("1", { reactions: [{ userId: "1", emoji: "\u{1F44D}" }] });
    const reply = msg("2", { replyToMessageId: "1", replyTo: quote("1") });
    const [first, second] = applyUpdate([original, reply], update("1", { recalledAt: "2026-10-27T09:00:00Z" }));
    expect(first).toMatchObject({ content: null, stickerId: null, reactions: [], recalledAt: "2026-10-27T09:00:00Z" });
    expect(second.replyTo).toMatchObject({ state: "RECALLED", content: null, type: null });
  });

  it("a later reaction update cannot bring a recalled message back", () => {
    const recalled = msg("1", { content: null, recalledAt: "2026-10-27T09:00:00Z", revision: 2 });
    const next = applyUpdate([recalled], update("1", { revision: 1, reactions: [{ userId: "1", emoji: "\u{1F44D}" }] }));
    expect(next[0].reactions).toEqual([]);
  });
});

describe("removeMessage", () => {
  it("drops the message and makes quotes of it unavailable, leaving others alone", () => {
    const next = removeMessage(
      [msg("1"), msg("2", { replyTo: quote("1"), replyToMessageId: "1" }), msg("3", { replyTo: quote("9"), replyToMessageId: "9" })],
      "1",
    );
    expect(next.map((m) => m.id)).toEqual(["2", "3"]);
    expect(next[0].replyTo).toMatchObject({ state: "UNAVAILABLE", senderId: null, content: null });
    expect(next[1].replyTo?.state).toBe("OK");
  });
});

describe("reactions", () => {
  const reactions = [
    { userId: "1", emoji: "\u{1F44D}" },
    { userId: "2", emoji: "\u{1F602}" },
    { userId: "3", emoji: "\u{1F44D}" },
  ];

  it("groups by emoji, most used first, and marks the viewer's own", () => {
    expect(groupReactions(reactions, "1")).toEqual([
      { emoji: "\u{1F44D}", count: 2, mine: true },
      { emoji: "\u{1F602}", count: 1, mine: false },
    ]);
  });

  it("finds the viewer's reaction", () => {
    expect(myReaction(msg("1", { reactions }), "2")).toBe("\u{1F602}");
    expect(myReaction(msg("1"), "2")).toBeNull();
  });

  it("offers the six reactions the server accepts", () => {
    expect(REACTION_EMOJIS).toHaveLength(6);
  });
});

describe("reply helpers", () => {
  it("cannot reply to a recalled message", () => {
    expect(canReplyTo(msg("1"))).toBe(true);
    expect(canReplyTo(msg("1", { recalledAt: "2026-10-27T09:00:00Z" }))).toBe(false);
  });

  it("quotes text on one line and a sticker by name", () => {
    expect(quoteText("a\n  b", "TEXT")).toBe("a b");
    expect(quoteText(null, "STICKER")).toBe("Sticker");
  });
});

describe("messagePreview recalled", () => {
  const base = { lastMessageContent: null, lastMessageType: "TEXT" as const, lastMessageRecalled: true };
  it("says so without quoting", () => {
    expect(messagePreview({ ...base, lastMessageSenderId: "1" }, "1")).toBe("You recalled a message");
    expect(messagePreview({ ...base, lastMessageSenderId: "2" }, "1")).toBe("Message recalled");
  });
});

describe("reconcileWindow", () => {
  it("drops a message the page skips inside what it covers, and keeps newer and older ones it cannot judge", () => {
    const current = [msg("1"), msg("2"), msg("3"), msg("4"), msg("5")];
    // The page reached back to "2" only and does not return "3"; "5" is newer than anything it holds.
    const next = reconcileWindow(current, [msg("4"), msg("2")], false);
    expect(next.map((m) => m.id)).toEqual(["1", "2", "4", "5"]);
  });

  it("when the page reached the start, everything older than its newest that it lacks is gone", () => {
    const next = reconcileWindow([msg("1"), msg("2"), msg("3")], [msg("3"), msg("2")], true);
    expect(next.map((m) => m.id)).toEqual(["2", "3"]);
  });

  it("applies revisions while reconciling", () => {
    const recalled = msg("2", { content: null, recalledAt: "2026-10-27T09:00:00Z", revision: 3 });
    const next = reconcileWindow([msg("2")], [recalled], true);
    expect(next[0].recalledAt).not.toBeNull();
  });
});
