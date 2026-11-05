"use client";

import { usePathname } from "next/navigation";
import { createContext, useContext, useEffect, useMemo, useReducer, useState } from "react";

import {
  CLOSED_PANEL,
  panelReducer,
  type PanelState,
  type PanelTarget,
} from "@/lib/messages-panel";

export type MessagesPanel = PanelState & {
  /** False below 769px, where Messages stays the full-page route. */
  available: boolean;
  toggle: () => void;
  close: () => void;
  expand: () => void;
  collapse: () => void;
  go: (target: PanelTarget) => void;
};

const NONE: MessagesPanel = {
  ...CLOSED_PANEL,
  available: false,
  toggle: () => {},
  close: () => {},
  expand: () => {},
  collapse: () => {},
  go: () => {},
};

const MessagesPanelContext = createContext<MessagesPanel>(NONE);

/** Set only inside the panel: links to message routes navigate the panel instead of the page. */
export const PanelNavContext = createContext<((target: PanelTarget) => void) | null>(null);

/**
 * Root-level so the floating chat can step aside while the panel shows the same conversations.
 * The panel yields to the full-page `/messages…` routes: arriving on one closes it.
 */
export function MessagesPanelProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(panelReducer, CLOSED_PANEL);
  const [available, setAvailable] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    const query = window.matchMedia("(min-width: 769px)");
    const sync = () => setAvailable(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);

  const shut = !available || pathname.startsWith("/messages");
  useEffect(() => {
    if (shut) dispatch({ type: "close" });
  }, [shut]);

  const value = useMemo<MessagesPanel>(
    () => ({
      ...state,
      available,
      toggle: () => dispatch({ type: "toggle" }),
      close: () => dispatch({ type: "close" }),
      expand: () => dispatch({ type: "expand" }),
      collapse: () => dispatch({ type: "collapse" }),
      go: (target) => dispatch({ type: "go", target }),
    }),
    [state, available],
  );

  return <MessagesPanelContext.Provider value={value}>{children}</MessagesPanelContext.Provider>;
}

export function useMessagesPanel(): MessagesPanel {
  return useContext(MessagesPanelContext);
}
