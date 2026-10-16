"use client";

import { getLocalSettings } from "@/lib/settings/local-settings";

/**
 * The browser's permission, plus the case the DOM has no value for: a browser
 * with no Notification API at all (older Safari on iOS, and any non-secure
 * origin). Kept distinct from `denied` because the switch says something
 * different for each — one can be undone in browser settings, the other cannot.
 */
export type NotificationPermissionState =
  | "default"
  | "granted"
  | "denied"
  | "unsupported";

/**
 * Whether an arriving notification should also raise a desktop one.
 *
 * Three independent gates, which is exactly why this is worth its own
 * function: the viewer's stored preference, the browser permission — which can
 * be revoked at any time without telling us — and whether they are already
 * looking at the page. A native popup for something the open tab is about to
 * render in its own inbox is pure noise, so a visible document suppresses it.
 */
export function shouldNotify(input: {
  enabled: boolean;
  permission: NotificationPermissionState;
  documentHidden: boolean;
}): boolean {
  return input.enabled && input.permission === "granted" && input.documentHidden;
}

/* ----------------------------------------------------------- the permission */

/*
 * A module store rather than component state: the permission changes out from
 * under React (the browser prompt, or the site settings panel), and several
 * places read it. Same shape as the settings store next door.
 */
let snapshot: NotificationPermissionState | null = null;
const listeners = new Set<() => void>();

function read(): NotificationPermissionState {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return "unsupported";
  }
  return Notification.permission;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (snapshot === null) snapshot = read();
  return snapshot;
}

/** Nothing to ask on the server, and the switch must render off during SSR. */
export function getServerNotificationPermission(): NotificationPermissionState {
  return "unsupported";
}

export function subscribeNotificationPermission(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function publish(next: NotificationPermissionState): NotificationPermissionState {
  snapshot = next;
  listeners.forEach((listener) => listener());
  return next;
}

/**
 * Shows the browser's own prompt, or resolves straight away when the answer is
 * already known — `requestPermission` on an account that has decided returns
 * the standing answer without prompting, so there is no need to branch here.
 */
export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (read() === "unsupported") return publish("unsupported");

  try {
    return publish(await Notification.requestPermission());
  } catch {
    // Safari once took a callback instead of returning a promise; a browser
    // that throws here has told us nothing, so re-read rather than guess.
    return publish(read());
  }
}

/* --------------------------------------------------------------- the notice */

export interface BrowserNotice {
  /** Collapses repeats of one inbox entry into a single desktop notification. */
  id: string;
  title: string;
  body: string;
}

/**
 * Raises a desktop notification for something that just landed in the inbox,
 * if all three gates in {@link shouldNotify} are open.
 *
 * Self-gating on purpose: the realtime handler that calls this should not have
 * to know about permissions, and a caller that forgets the check is the way
 * this ends up notifying people who switched it off.
 */
export function showBrowserNotification(notice: BrowserNotice): void {
  const allowed = shouldNotify({
    enabled: getLocalSettings().browserNotifications,
    permission: getNotificationPermission(),
    documentHidden: document.hidden,
  });
  if (!allowed) return;

  try {
    const notification = new Notification(notice.title, {
      body: notice.body,
      icon: "/images/brand/nowa-icon.png",
      tag: notice.id,
    });
    notification.onclick = () => {
      window.focus();
      notification.close();
    };
  } catch {
    // Chrome on Android throws here: the constructor is unavailable and pushes
    // have to come through a service worker. Nothing to fall back to.
  }
}
