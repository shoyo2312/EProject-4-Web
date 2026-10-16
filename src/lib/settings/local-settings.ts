"use client";

/** localStorage key holding the serialised {@link LocalSettings}. */
const STORAGE_KEY = "tt:settings";

/**
 * Viewer preferences this app can honour with no backend behind them: two
 * `/setting` rows, and the sidebar's collapse toggle.
 *
 * The account-level rows save to user-service (`useAccountSettings`). These
 * are not account state: the live page's own copy scopes contrast to "your
 * computer", desktop notifications are a browser permission, and a sidebar
 * width only makes sense for the screen it was picked on. So `localStorage` is
 * where they belong, not an endpoint that is missing.
 */
export interface LocalSettings {
  highContrast: boolean;
  /**
   * Whether the viewer asked for desktop notifications.
   *
   * Deliberately separate from the browser's own permission. The permission can
   * be granted while this is false — asked once, switched back off — and a
   * permission revoked in browser settings has to beat a stored `true`. The two
   * are reconciled in `shouldNotify`, never by mirroring one into the other.
   */
  browserNotifications: boolean;
  /**
   * Whether the reader collapsed the sidebar to its icon rail. Only read above
   * 1024px — below it the rail is icon-only whatever this says.
   */
  sideNavCollapsed: boolean;
}

export const DEFAULT_LOCAL_SETTINGS: LocalSettings = {
  highContrast: false,
  browserNotifications: false,
  sideNavCollapsed: false,
};

/**
 * Validates one stored blob. Every field is re-checked: the value is
 * user-writable, and anything that is not a boolean has to fall back rather
 * than reach a `classList.toggle` as `undefined`.
 *
 * Pure, so the parsing rules can be tested without touching storage.
 */
export function parseLocalSettings(raw: string | null): LocalSettings {
  if (!raw) return DEFAULT_LOCAL_SETTINGS;

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
  if (typeof parsed !== "object" || parsed === null) return DEFAULT_LOCAL_SETTINGS;

  const { highContrast, browserNotifications, sideNavCollapsed } =
    parsed as Partial<LocalSettings>;
  return {
    highContrast:
      typeof highContrast === "boolean"
        ? highContrast
        : DEFAULT_LOCAL_SETTINGS.highContrast,
    browserNotifications:
      typeof browserNotifications === "boolean"
        ? browserNotifications
        : DEFAULT_LOCAL_SETTINGS.browserNotifications,
    sideNavCollapsed:
      typeof sideNavCollapsed === "boolean"
        ? sideNavCollapsed
        : DEFAULT_LOCAL_SETTINGS.sideNavCollapsed,
  };
}

/* ---------------------------------------------------------------- the store */

/*
 * Same shape as `PlayerSettingsProvider`'s store, and for the same reason:
 * `getSnapshot` has to return a referentially stable value while nothing has
 * changed, so the parse result is cached rather than recomputed per call.
 */
let snapshot: LocalSettings = DEFAULT_LOCAL_SETTINGS;
let loaded = false;

const listeners = new Set<() => void>();

export function getLocalSettings(): LocalSettings {
  if (!loaded) {
    snapshot = read();
    loaded = true;
  }
  return snapshot;
}

/** No storage on the server, so every SSR render sees the defaults. */
export function getServerLocalSettings(): LocalSettings {
  return DEFAULT_LOCAL_SETTINGS;
}

export function subscribeLocalSettings(onChange: () => void): () => void {
  listeners.add(onChange);

  // Another tab is a separate React tree; its writes only arrive as this event.
  const sync = (event: StorageEvent) => {
    if (event.key !== null && event.key !== STORAGE_KEY) return;
    snapshot = read();
    loaded = true;
    listeners.forEach((listener) => listener());
  };
  window.addEventListener("storage", sync);

  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", sync);
  };
}

export function setHighContrast(on: boolean): void {
  write({ ...getLocalSettings(), highContrast: on });
}

export function setBrowserNotifications(on: boolean): void {
  write({ ...getLocalSettings(), browserNotifications: on });
}

export function setSideNavCollapsed(collapsed: boolean): void {
  write({ ...getLocalSettings(), sideNavCollapsed: collapsed });
}

function write(next: LocalSettings): void {
  snapshot = next;
  loaded = true;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Private mode or a full quota — the preference just stops persisting.
  }
  listeners.forEach((listener) => listener());
}

function read(): LocalSettings {
  try {
    return parseLocalSettings(window.localStorage.getItem(STORAGE_KEY));
  } catch {
    return DEFAULT_LOCAL_SETTINGS;
  }
}
