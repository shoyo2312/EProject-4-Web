"use client";

import { useEffect, useState } from "react";

/**
 * Keeps something mounted for `exitMs` after `open` turns false, so it can
 * transition out instead of vanishing — `closing` is true for that window.
 *
 * Opening again inside the window cancels the exit without a remount, so the
 * transition turns around from wherever it had got to.
 */
export function usePresence(
  open: boolean,
  exitMs: number,
): { mounted: boolean; closing: boolean } {
  const [mounted, setMounted] = useState(open);
  // During render rather than in an effect, so the frame that opens it
  // already has it mounted.
  if (open && !mounted) setMounted(true);

  useEffect(() => {
    if (open || !mounted) return;
    const timer = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(timer);
  }, [open, mounted, exitMs]);

  return { mounted, closing: mounted && !open };
}
