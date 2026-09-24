"use client";

import { useEffect } from "react";

import { useLocalSettings } from "@/hooks/use-local-settings";

/**
 * Writes `.high-contrast` on `<html>` so the token overrides in `globals.css`
 * reach the whole tree.
 *
 * A class on the root is the only shared place: the tokens it shifts are read
 * by every component in the app, most of them nowhere near `/setting`. Same
 * arrangement `Feed` uses for `.comments-open`.
 *
 * Mounted in the root layout, and renders nothing. There is one frame of the
 * default palette on a cold load — the preference lives in `localStorage`,
 * which the server render cannot see. A blocking inline script would remove it,
 * at the cost of a `dangerouslySetInnerHTML` in the document head; this row
 * only shifts a few alpha values rather than flipping a theme, so the flash is
 * not worth that.
 */
export function HighContrastSync() {
  const { highContrast } = useLocalSettings();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("high-contrast", highContrast);
    return () => root.classList.remove("high-contrast");
  }, [highContrast]);

  return null;
}
