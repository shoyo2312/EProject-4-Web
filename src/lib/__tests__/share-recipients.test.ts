import { describe, expect, it, vi } from "vitest";

import type { ConversationResponse, MessageResponse } from "@/lib/api/conversations";
import { ApiError } from "@/lib/api/errors";
import type { Author } from "@/types/tiktok";
import {
  MAX_RECIPIENTS,
  describeFailure,
  mapLimit,
  recentRecipients,
  requestKey,
  runShare,
  togglePick,
  unavailableReason,
  type ShareDeps,
  type ShareRecipient,
} from "../share-recipients";

const ME = "1";

function convo(id: string, other: string, minute: number | null, over: Partial<ConversationResponse> = {}): ConversationResponse {
  return {
    id,
    participantIds: [ME, other],
    lastMessageContent: "x",
    lastMessageType: "TEXT",
    lastMessageSenderId: other,
    lastMessageAt: minute === null ? null : new Date(Date.UTC(2026, 9, 28, 8, minute)).toISOString(),
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
    ...over,
  };
}

const author = (id: string): Author => ({ userId: id, nickname: `n${id}`, username: `u${id}`, avatarUrl: "" }) as Author;
const authors = (...ids: string[]) => new Map(ids.map((id) => [id, author(id)]));
const ids = (list: ShareRecipient[]) => list.map((r) => r.userId);

describe("recentRecipients", () => {
  it("orders by the newest message, not by the inbox order or pin", () => {
    const inbox = [
      convo("c-pinned", "10", 1, { pinnedAt: "2026-10-28T09:00:00.000Z" }),
      convo("c-new", "11", 30),
      convo("c-mid", "12", 20),
    ];
    expect(ids(recentRecipients(inbox, authors("10", "11", "12"), ME))).toEqual(["11", "12", "10"]);
  });

  it("leaves out the viewer, repeats, deleted and blocked conversations and people with no profile yet", () => {
    const inbox = [
      convo("a", "10", 30),
      convo("a2", "10", 29),
      convo("self", ME, 28),
      convo("hidden", "11", 27, { inboxHidden: true }),
      convo("declined", "12", 26, { requestState: "DECLINED", initiatorId: "12" }),
      convo("blocked", "13", 25, { messagingBlocked: true }),
      convo("mine-blocked", "14", 24, { blockedByViewer: true, messagingBlocked: true }),
      convo("noauthor", "15", 23),
      convo("ok", "16", 22),
    ];
    expect(ids(recentRecipients(inbox, authors("10", "11", "12", "13", "14", "16"), ME))).toEqual(["10", "16"]);
  });

  it("keeps a conversation whose block state is unknown", () => {
    const inbox = [convo("a", "10", 5, { blockedByViewer: null, messagingBlocked: null })];
    expect(ids(recentRecipients(inbox, authors("10"), ME))).toEqual(["10"]);
  });

  it("puts conversations with no message last and caps the list", () => {
    const inbox = [convo("empty", "10", null), convo("a", "11", 1)];
    expect(ids(recentRecipients(inbox, authors("10", "11"), ME))).toEqual(["11", "10"]);
    expect(recentRecipients(inbox, authors("10", "11"), ME, 1)).toHaveLength(1);
  });
});

describe("unavailableReason", () => {
  it("says why a known conversation cannot take a message, and nothing for strangers", () => {
    const inbox = [convo("a", "10", 1, { messagingBlocked: true }), convo("b", "11", 1, { sendPermission: "REQUEST_SENT" })];
    expect(unavailableReason("10", inbox, ME)).toMatch(/can.t message/i);
    expect(unavailableReason("11", inbox, ME)).toMatch(/accept/i);
    expect(unavailableReason("99", inbox, ME)).toBeNull();
  });
});

describe("togglePick", () => {
  const person = (id: string): ShareRecipient => ({ userId: id, author: author(id) });

  it("selects and deselects by user id", () => {
    const one = togglePick(new Map(), person("10"));
    expect([...one.keys()]).toEqual(["10"]);
    expect(togglePick(one, { userId: "10", author: { ...author("10"), nickname: "renamed" } }).size).toBe(0);
  });

  it("refuses an add past the cap but still allows removing", () => {
    let picked: ReadonlyMap<string, ShareRecipient> = new Map();
    for (let i = 0; i < MAX_RECIPIENTS; i += 1) picked = togglePick(picked, person(String(100 + i)));
    expect(picked.size).toBe(MAX_RECIPIENTS);
    expect(togglePick(picked, person("999"))).toBe(picked);
    expect(togglePick(picked, person("100")).size).toBe(MAX_RECIPIENTS - 1);
  });
});

describe("mapLimit", () => {
  it("never runs more than the limit at once and keeps the order", async () => {
    let active = 0;
    let peak = 0;
    const out = await mapLimit([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((r) => setTimeout(r, 5));
      active -= 1;
      return n * 2;
    });
    expect(out).toEqual([2, 4, 6, 8, 10, 12, 14]);
    expect(peak).toBeLessThanOrEqual(3);
  });
});

describe("runShare", () => {
  const person = (id: string): ShareRecipient => ({ userId: id, author: author(id) });
  const sent = (id: string): MessageResponse => ({ id, conversationId: "c", senderId: ME }) as MessageResponse;

  function deps(over: Partial<ShareDeps> = {}) {
    return {
      openConversation: vi.fn<ShareDeps["openConversation"]>(async (userId) => convo(`c${userId}`, userId, 1)),
      sendMessage: vi.fn<ShareDeps["sendMessage"]>(async (conversationId) => sent(`m-${conversationId}`)),
      confirmReopen: vi.fn<ShareDeps["confirmReopen"]>(async () => true),
      ...over,
    } as {
      openConversation: ReturnType<typeof vi.fn<ShareDeps["openConversation"]>>;
      sendMessage: ReturnType<typeof vi.fn<ShareDeps["sendMessage"]>>;
      confirmReopen: ReturnType<typeof vi.fn<ShareDeps["confirmReopen"]>>;
    };
  }
  const run = (recipients: ShareRecipient[], over = {}) => ({
    videoId: "v1",
    note: " hi ",
    attemptId: "att",
    recipients,
    alreadySent: new Set<string>(),
    ...over,
  });

  it("sends one VIDEO message per person, with the note trimmed, once, and a stable key", async () => {
    const d = deps();
    const results = await runShare(run([person("10"), person("11")]), d);
    expect(d.sendMessage).toHaveBeenCalledTimes(2);
    expect(d.sendMessage).toHaveBeenCalledWith("c10", {
      type: "VIDEO",
      videoId: "v1",
      content: "hi",
      clientRequestId: requestKey("att", "10"),
    });
    expect(results?.get("10")?.ok).toBe(true);
    expect(results?.get("11")?.ok).toBe(true);
  });

  it("omits an empty note", async () => {
    const d = deps();
    await runShare(run([person("10")], { note: "   " }), d);
    expect(d.sendMessage.mock.calls[0][1]).not.toHaveProperty("content");
  });

  it("reports a partial success per person and does not undo the ones that went through", async () => {
    const d = deps({
      sendMessage: vi.fn(async (conversationId: string) => {
        if (conversationId === "c11") throw new ApiError(403, "MESSAGING_BLOCKED", "x");
        return sent(`m-${conversationId}`);
      }),
    });
    const results = await runShare(run([person("10"), person("11"), person("12")]), d);
    expect([...results!].map(([id, r]) => [id, r.ok])).toEqual(
      expect.arrayContaining([["10", true], ["11", false], ["12", true]]),
    );
    const failed = results!.get("11");
    expect(failed && !failed.ok && failed.reason).toMatch(/can.t message/i);
  });

  it("retries only the failed ones, with the same key, and never resends a delivered one", async () => {
    const d = deps();
    await runShare(run([person("10"), person("11")], { alreadySent: new Set(["10"]) }), d);
    expect(d.openConversation).toHaveBeenCalledTimes(1);
    expect(d.sendMessage).toHaveBeenCalledTimes(1);
    expect(d.sendMessage.mock.calls[0][1].clientRequestId).toBe(requestKey("att", "11"));
  });

  it("sends nothing and returns null when the reopening is declined, naming who it was about", async () => {
    const d = deps({
      openConversation: vi.fn(async (userId: string) =>
        convo(`c${userId}`, userId, 1, userId === "11" ? { sendPermission: "REOPEN_ON_SEND" } : {}),
      ),
      confirmReopen: vi.fn(async () => false),
    });
    const results = await runShare(run([person("10"), person("11")]), d);
    expect(results).toBeNull();
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect(d.confirmReopen.mock.calls[0][0].map((r: ShareRecipient) => r.userId)).toEqual(["11"]);
  });

  it("goes ahead once the reopening is confirmed", async () => {
    const d = deps({
      openConversation: vi.fn(async (userId: string) => convo(`c${userId}`, userId, 1, { sendPermission: "REOPEN_ON_SEND" })),
    });
    const results = await runShare(run([person("10")]), d);
    expect(d.confirmReopen).toHaveBeenCalledTimes(1);
    expect(results?.get("10")?.ok).toBe(true);
  });

  it("does not send into a conversation the server reports as closed, and says why", async () => {
    const d = deps({
      openConversation: vi.fn(async (userId: string) =>
        convo(`c${userId}`, userId, 1, userId === "10" ? { messagingBlocked: true } : { sendPermission: "REQUEST_SENT" }),
      ),
    });
    const results = await runShare(run([person("10"), person("11")]), d);
    expect(d.sendMessage).not.toHaveBeenCalled();
    expect([...results!.values()].every((r) => !r.ok)).toBe(true);
  });

  it("a conversation that cannot be opened fails that person only", async () => {
    const d = deps({
      openConversation: vi.fn(async (userId: string) => {
        if (userId === "10") throw new ApiError(403, "MESSAGING_NOT_ALLOWED", "x");
        return convo(`c${userId}`, userId, 1);
      }),
    });
    const results = await runShare(run([person("10"), person("11")]), d);
    expect(results?.get("10")?.ok).toBe(false);
    expect(results?.get("11")?.ok).toBe(true);
    expect(d.sendMessage).toHaveBeenCalledTimes(1);
  });
});

describe("describeFailure", () => {
  it("names the video refusals and does not call an outage a deletion", () => {
    expect(describeFailure(new ApiError(404, "VIDEO_NOT_AVAILABLE", "x"))).toMatch(/isn.t available/i);
    expect(describeFailure(new ApiError(422, "VIDEO_NOT_SHAREABLE_TO_RECIPIENT", "x"))).toMatch(/can.t view/i);
    const outage = describeFailure(new ApiError(503, "VIDEO_CHECK_UNAVAILABLE", "x"));
    expect(outage).toMatch(/try again/i);
    expect(outage).not.toMatch(/isn.t available|deleted/i);
  });
});
