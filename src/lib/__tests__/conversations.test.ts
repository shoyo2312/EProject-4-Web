import { describe, expect, it } from "vitest";

import { normalizeConversation, parseChatEvent, parseMessageFrame } from "@/lib/api/conversations";

describe("parseChatEvent", () => {
  it("keeps 18-digit ids exact, so a message from me is still recognised as mine", () => {
    const body =
      '{"type":"MESSAGE","conversationId":"372385978751229952","message":{"id":"372386006643351552",' +
      '"conversationId":"372385978751229952","senderId":372385859884797952,"content":"hi","sentAt":"2026-10-26T12:00:00Z"}}';

    const event = parseChatEvent(body);

    expect(event?.type).toBe("MESSAGE");
    if (event?.type === "MESSAGE") expect(event.message.senderId).toBe("372385859884797952");
  });

  it("reads a conversation snapshot with its request state and send permission", () => {
    const body =
      '{"type":"CONVERSATION","conversationId":"c1","conversation":{"id":"c1","participantIds":[372385859884797952,372385863873581056],' +
      '"lastMessageContent":"hello","lastMessageSenderId":372385859884797952,"lastMessageAt":"2026-10-26T12:00:00Z","createdAt":null,' +
      '"hasUnread":true,"requestState":"PENDING","initiatorId":372385859884797952,"sendPermission":"AWAITING_ACCEPT"}}';

    const event = parseChatEvent(body);

    expect(event?.type).toBe("CONVERSATION");
    if (event?.type === "CONVERSATION") {
      expect(event.conversation.participantIds).toEqual(["372385859884797952", "372385863873581056"]);
      expect(event.conversation.initiatorId).toBe("372385859884797952");
      expect(event.conversation.requestState).toBe("PENDING");
      expect(event.conversation.sendPermission).toBe("AWAITING_ACCEPT");
    }
  });

  it("drops anything that is not a well-formed event", () => {
    expect(parseChatEvent("not json")).toBeNull();
    expect(parseChatEvent('{"type":"MESSAGE"}')).toBeNull();
    expect(parseChatEvent('{"type":"OTHER","conversationId":"c1"}')).toBeNull();
    expect(parseChatEvent("null")).toBeNull();
  });
});

describe("parseMessageFrame", () => {
  it("keeps the sender id exact", () => {
    const frame = parseMessageFrame(
      '{"id":"1","conversationId":"c","senderId":372385859884797952,"content":"x","sentAt":"2026-10-26T12:00:00Z"}',
    );
    expect(frame?.senderId).toBe("372385859884797952");
  });
});

describe("normalizeConversation", () => {
  it("treats a conversation from a backend without requests as ordinary", () => {
    const conversation = normalizeConversation({
      id: "c1",
      participantIds: [1, 2],
      lastMessageContent: null,
      lastMessageSenderId: null,
      lastMessageAt: null,
      createdAt: null,
      hasUnread: false,
    });
    expect(conversation.requestState).toBeNull();
    expect(conversation.initiatorId).toBeNull();
    expect(conversation.sendPermission).toBe("ALLOWED");
  });
});

describe("stickers on the wire", () => {
  const sticker =
    '{"stickerId":"fire","name":"Fire","url":"http://localhost:9000/video-media/stickers/fluent-3d/v1/fire.png","width":256,"height":256}';

  it("reads a sticker frame on a conversation topic that has no content, keeping the sender id exact", () => {
    const frame = parseMessageFrame(
      `{"id":"372386006643351552","conversationId":"c1","senderId":372385859884797952,"type":"STICKER","content":null,"stickerId":"fire","sticker":${sticker},"sentAt":"2026-10-27T08:00:00Z"}`,
    );

    expect(frame?.type).toBe("STICKER");
    expect(frame?.content).toBeNull();
    expect(frame?.sticker?.url).toMatch(/\/stickers\/fluent-3d\/v1\/fire\.png$/);
    expect(frame?.senderId).toBe("372385859884797952");
    expect(frame?.id).toBe("372386006643351552");
  });

  it("reads a sticker frame whose content is missing altogether", () => {
    const frame = parseMessageFrame(
      `{"id":"9","conversationId":"c1","senderId":2,"type":"STICKER","stickerId":"fire","sticker":${sticker},"sentAt":"2026-10-27T08:00:00Z"}`,
    );
    expect(frame?.content).toBeNull();
  });

  it("reads the same sticker out of a /user/queue/chat MESSAGE event", () => {
    const event = parseChatEvent(
      `{"type":"MESSAGE","conversationId":"c1","message":{"id":"9","conversationId":"c1","senderId":372385859884797952,"type":"STICKER","stickerId":"fire","sticker":${sticker},"sentAt":"2026-10-27T08:00:00Z"}}`,
    );

    expect(event?.type).toBe("MESSAGE");
    if (event?.type === "MESSAGE") {
      expect(event.message.type).toBe("STICKER");
      expect(event.message.senderId).toBe("372385859884797952");
      expect(event.message.sticker?.name).toBe("Fire");
    }
  });

  it("keeps the conversation preview type from a CONVERSATION event", () => {
    const event = parseChatEvent(
      '{"type":"CONVERSATION","conversationId":"c1","conversation":{"id":"c1","participantIds":[1,2],"lastMessageContent":null,"lastMessageType":"STICKER","lastMessageSenderId":2,"lastMessageAt":"2026-10-27T08:00:00Z","createdAt":null,"hasUnread":true}}',
    );
    expect(event?.type === "CONVERSATION" && event.conversation.lastMessageType).toBe("STICKER");
  });

  it("treats a message stored before types existed as text", () => {
    const frame = parseMessageFrame('{"id":"1","conversationId":"c1","senderId":2,"content":"old","sentAt":"2026-10-01T08:00:00Z"}');
    expect(frame?.type).toBe("TEXT");
    expect(frame?.content).toBe("old");
    expect(frame?.sticker).toBeNull();
  });

  it("still refuses a frame that is not a message", () => {
    expect(parseMessageFrame('{"id":"1","conversationId":"c1","senderId":2,"content":5,"sentAt":"x"}')).toBeNull();
    expect(parseMessageFrame('{"conversationId":"c1","senderId":2,"type":"STICKER","sentAt":"x"}')).toBeNull();
  });

  it("gives a conversation whose preview predates types the TEXT type", () => {
    const conversation = normalizeConversation({
      id: "c1",
      participantIds: [1, 2],
      lastMessageContent: "old preview",
      lastMessageSenderId: 2,
      lastMessageAt: "2026-10-01T08:00:00Z",
      createdAt: null,
      hasUnread: false,
    });
    expect(conversation.lastMessageType).toBe("TEXT");
  });
});

describe("parseChatEvent RECEIPT", () => {
  const mark = '{"messageId":"372385978751229952","sentAt":"2026-10-28T08:00:00Z","at":"2026-10-28T08:05:00Z"}';

  it("reads the other side's marks, with ids kept exact", () => {
    const event = parseChatEvent(
      '{"type":"RECEIPT","conversationId":"c1","receipt":{"conversationId":"c1","userId":365050354607333376,' +
        `"delivered":${mark},"read":null}}`,
    );
    expect(event).toEqual({
      type: "RECEIPT",
      conversationId: "c1",
      receipt: {
        userId: "365050354607333376",
        delivered: { messageId: "372385978751229952", sentAt: "2026-10-28T08:00:00Z", at: "2026-10-28T08:05:00Z" },
        read: null,
      },
    });
  });

  it("drops a frame that does not say whose marks they are", () => {
    expect(parseChatEvent(JSON.stringify({ type: "RECEIPT", conversationId: "c1", receipt: { delivered: null } }))).toBeNull();
  });
});

describe("parseChatEvent TYPING", () => {
  it("reads who is typing where, with an exact user id", () => {
    const event = parseChatEvent(
      '{"type":"TYPING","conversationId":"c1","typing":{"conversationId":"c1","userId":365050354607333376,"typing":true}}',
    );
    expect(event).toEqual({ type: "TYPING", conversationId: "c1", userId: "365050354607333376", typing: true });
  });

  it("drops a frame with no flag, no user or no conversation", () => {
    expect(parseChatEvent('{"type":"TYPING","conversationId":"c1","typing":{"conversationId":"c1","userId":2}}')).toBeNull();
    expect(parseChatEvent('{"type":"TYPING","conversationId":"c1","typing":{"conversationId":"c1","typing":true}}')).toBeNull();
    expect(parseChatEvent('{"type":"TYPING","conversationId":"c1","typing":{"userId":2,"typing":true}}')).toBeNull();
  });
});
