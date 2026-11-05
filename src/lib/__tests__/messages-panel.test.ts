import { describe, expect, it } from "vitest";

import {
  CLOSED_PANEL,
  panelReducer,
  panelReservedWidth,
  parseMessagesHref,
  type PanelState,
} from "@/lib/messages-panel";

const compact: PanelState = { mode: "compact", conversationId: null, requests: false };
const thread: PanelState = { mode: "compact", conversationId: "c1", requests: false };

describe("panelReducer", () => {
  it("opens compact on the inbox and toggles shut", () => {
    const open = panelReducer(CLOSED_PANEL, { type: "toggle" });
    expect(open).toEqual(compact);
    expect(panelReducer(open, { type: "toggle" })).toEqual(CLOSED_PANEL);
  });

  it("selecting a conversation stays compact", () => {
    expect(panelReducer(compact, { type: "go", target: { kind: "conversation", id: "c1" } })).toEqual(thread);
  });

  it("expand and collapse keep the conversation", () => {
    const wide = panelReducer(thread, { type: "expand" });
    expect(wide).toEqual({ ...thread, mode: "expanded" });
    expect(panelReducer(wide, { type: "collapse" })).toEqual(thread);
  });

  it("selecting inside the expanded panel does not collapse it", () => {
    const wide = panelReducer(compact, { type: "expand" });
    const next = panelReducer(wide, { type: "go", target: { kind: "conversation", id: "c2" } });
    expect(next.mode).toBe("expanded");
  });

  it("close forgets the thread; back to the inbox or requests clears it", () => {
    expect(panelReducer(thread, { type: "close" })).toEqual(CLOSED_PANEL);
    expect(panelReducer(thread, { type: "go", target: { kind: "requests" } })).toEqual({
      mode: "compact",
      conversationId: null,
      requests: true,
    });
  });

  it("expand on a closed panel does nothing", () => {
    expect(panelReducer(CLOSED_PANEL, { type: "expand" })).toBe(CLOSED_PANEL);
  });
});

describe("parseMessagesHref", () => {
  it("maps the three message routes", () => {
    expect(parseMessagesHref("/messages")).toEqual({ kind: "inbox" });
    expect(parseMessagesHref("/messages/requests")).toEqual({ kind: "requests" });
    expect(parseMessagesHref("/messages/abc123")).toEqual({ kind: "conversation", id: "abc123" });
  });

  it("ignores other routes", () => {
    expect(parseMessagesHref("/@someone")).toBeNull();
    expect(parseMessagesHref("/messages/a/b")).toBeNull();
  });
});

describe("panelReservedWidth", () => {
  it("is zero closed, wider with a thread", () => {
    expect(panelReservedWidth(CLOSED_PANEL)).toBe(0);
    expect(panelReservedWidth(compact)).toBe(320);
    expect(panelReservedWidth(thread)).toBe(420);
  });
});
