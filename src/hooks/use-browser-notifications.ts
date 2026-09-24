"use client";

import { useCallback, useSyncExternalStore } from "react";

import { useLocalSettings } from "@/hooks/use-local-settings";
import { useMounted } from "@/hooks/use-mounted";
import {
  getNotificationPermission,
  getServerNotificationPermission,
  requestNotificationPermission,
  subscribeNotificationPermission,
} from "@/lib/settings/browser-notifications";
import { setBrowserNotifications } from "@/lib/settings/local-settings";

export interface BrowserNotificationsControl {
  /** What the switch shows: on only when the preference *and* the grant hold. */
  on: boolean;
  /** No Notification API here — the switch is disabled rather than lying. */
  unsupported: boolean;
  /** Blocked at the browser level, which only browser settings can undo. */
  blocked: boolean;
  /** Resolves to the reason it could not be turned on, or null on success. */
  toggle: () => Promise<string | null>;
}

const BLOCKED_MESSAGE =
  "Notifications are blocked for this site. Allow them in your browser settings, then try again.";
const UNSUPPORTED_MESSAGE = "This browser cannot show desktop notifications.";

/**
 * Drives the "Allow in browser" switch.
 *
 * The stored preference is not the whole answer — a permission revoked in the
 * browser has to win over it — so the switch reads as on only when both agree,
 * and turning it on asks for the grant first. A preference left `true` behind a
 * revoked grant is kept rather than cleared: re-granting should restore the
 * choice the viewer already made instead of making them find this row again.
 */
export function useBrowserNotifications(): BrowserNotificationsControl {
  const { browserNotifications } = useLocalSettings();
  const permission = useSyncExternalStore(
    subscribeNotificationPermission,
    getNotificationPermission,
    getServerNotificationPermission,
  );

  const toggle = useCallback(async (): Promise<string | null> => {
    if (getNotificationPermission() === "unsupported") return UNSUPPORTED_MESSAGE;

    if (browserNotifications) {
      setBrowserNotifications(false);
      return null;
    }

    // Asked even when the grant already stands: `requestPermission` returns the
    // standing answer without prompting, and re-reading it here is what catches
    // a grant revoked since this tab loaded.
    const granted = await requestNotificationPermission();
    if (granted !== "granted") return BLOCKED_MESSAGE;

    setBrowserNotifications(true);
    return null;
  }, [browserNotifications]);

  /*
   * Nothing is known about the browser until this runs in one. Reporting the
   * server's `unsupported` verbatim disabled the switch and printed "this
   * browser cannot show desktop notifications" on every first paint, which is
   * a false claim even if it only lasts until hydration.
   */
  const mounted = useMounted();

  return {
    on: mounted && browserNotifications && permission === "granted",
    unsupported: mounted && permission === "unsupported",
    blocked: mounted && permission === "denied",
    toggle,
  };
}
