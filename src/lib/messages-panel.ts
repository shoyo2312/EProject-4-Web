/**
 * The Messages panel beside the sidebar: closed, compact (inbox or one thread next to an avatar
 * rail) or expanded (the whole content area). Panel state lives in memory, not in the URL, so
 * opening it never leaves the feed; `/messages…` stays the full-page route.
 */
export type PanelMode = "closed" | "compact" | "expanded";

export type PanelState = {
  mode: PanelMode;
  conversationId: string | null;
  requests: boolean;
};

export type PanelTarget =
  | { kind: "inbox" }
  | { kind: "requests" }
  | { kind: "conversation"; id: string };

export type PanelAction =
  | { type: "close" }
  | { type: "toggle" }
  | { type: "expand" }
  | { type: "collapse" }
  | { type: "go"; target: PanelTarget };

export const CLOSED_PANEL: PanelState = { mode: "closed", conversationId: null, requests: false };

export const PANEL_INBOX_WIDTH = 320;
export const PANEL_THREAD_WIDTH = 420;

export function panelReducer(state: PanelState, action: PanelAction): PanelState {
  switch (action.type) {
    case "close":
      return state.mode === "closed" ? state : CLOSED_PANEL;
    case "toggle":
      return state.mode === "closed" ? { ...state, mode: "compact" } : CLOSED_PANEL;
    case "expand":
      return state.mode === "closed" ? state : { ...state, mode: "expanded" };
    case "collapse":
      return state.mode === "expanded" ? { ...state, mode: "compact" } : state;
    case "go": {
      const mode = state.mode === "closed" ? "compact" : state.mode;
      if (action.target.kind === "conversation") {
        return { mode, conversationId: action.target.id, requests: false };
      }
      return { mode, conversationId: null, requests: action.target.kind === "requests" };
    }
  }
}

/** `/messages`, `/messages/requests` and `/messages/{id}` map to a panel target; anything else is null. */
export function parseMessagesHref(href: string): PanelTarget | null {
  const match = /^\/messages(?:\/([^/?#]+))?\/?(?:[?#].*)?$/.exec(href);
  if (!match) return null;
  const segment = match[1];
  if (!segment) return { kind: "inbox" };
  if (segment === "requests") return { kind: "requests" };
  return { kind: "conversation", id: decodeURIComponent(segment) };
}

/** Room the panel reserves beside the sidebar; expanded keeps the reservation it had when compact. */
export function panelReservedWidth(state: PanelState): number {
  if (state.mode === "closed") return 0;
  return state.conversationId ? PANEL_THREAD_WIDTH : PANEL_INBOX_WIDTH;
}
