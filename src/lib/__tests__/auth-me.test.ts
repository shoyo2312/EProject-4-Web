import { describe, expect, it, vi } from "vitest";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiFetch: (...args: unknown[]) => apiFetch(...args),
}));

import { getMe } from "@/lib/api/auth";
import { messagePreview, otherParticipantId } from "@/lib/chat";
import { normalizeConversation } from "@/lib/api/conversations";

describe("getMe", () => {
  it("gives a short account id as a string, so it compares with the ids chat-service sends", async () => {
    apiFetch.mockResolvedValue({ id: 9001, username: "mai" });
    const me = await getMe();
    expect(me.id).toBe("9001");

    const conversation = normalizeConversation({
      id: "c1",
      participantIds: [9001, 9002],
      lastMessageContent: "hi",
      lastMessageSenderId: 9001,
      lastMessageAt: "2026-10-27T08:00:00.000Z",
      createdAt: null,
      hasUnread: false,
    });
    // The other person, not the viewer; and the viewer's own message reads as theirs.
    expect(otherParticipantId(conversation, me.id)).toBe("9002");
    expect(messagePreview(conversation, me.id)).toBe("You: hi");
  });

  it("leaves a long id as the string it already is", async () => {
    apiFetch.mockResolvedValue({ id: "372028837771833344", username: "x" });
    expect((await getMe()).id).toBe("372028837771833344");
  });
});
