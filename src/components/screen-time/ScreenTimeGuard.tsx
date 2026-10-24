"use client";

import { useEffect } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { sendScreenTimeHeartbeat } from "@/lib/api/screen-time";

/** How often the page counts, in seconds. */
const TICK_SECONDS = 15;
/** Counted time goes to the server once there is this much of it. */
const SEND_AT_SECONDS = 60;
/** The most one heartbeat may carry; the server clamps there too. */
const MAX_PENDING_SECONDS = 120;

/**
 * Measures time on the site for Screen time. Every 15 seconds the tab is in
 * view and focused counts, and each minute of it goes to user-service with the
 * browser's time zone, which is what decides day time from night time. Renders
 * nothing.
 *
 * A send that fails keeps its seconds for the next try, up to the 120 one
 * heartbeat may carry: a long outage loses time rather than reporting it all
 * at once afterwards.
 */
export function ScreenTimeGuard() {
  const { user } = useSession();
  const signedIn = user !== null;

  useEffect(() => {
    if (!signedIn) return;
    let pending = 0;
    let sending = false;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible" || !document.hasFocus()) return;
      pending = Math.min(pending + TICK_SECONDS, MAX_PENDING_SECONDS);
      if (sending || pending < SEND_AT_SECONDS) return;

      const seconds = pending;
      pending = 0;
      sending = true;
      sendScreenTimeHeartbeat(seconds, Intl.DateTimeFormat().resolvedOptions().timeZone)
        .catch(() => {
          pending = Math.min(pending + seconds, MAX_PENDING_SECONDS);
        })
        .finally(() => {
          sending = false;
        });
    }, TICK_SECONDS * 1000);

    return () => window.clearInterval(timer);
  }, [signedIn]);

  return null;
}
