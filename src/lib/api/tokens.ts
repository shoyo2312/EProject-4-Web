"use client";

/**
 * Where the JWT pair lives between page loads.
 *
 * `localStorage` is the web counterpart of the `flutter_secure_storage` the
 * mobile contract asks for: it survives a reload, is per-origin, and is the
 * only option that works without moving the session onto the server. It is
 * readable by any script on the origin, so the real hardening step later is
 * httpOnly cookies set by a Next route handler — every call site already goes
 * through `lib/api/client.ts`, so that swap touches this file only.
 */

const ACCESS_KEY = "tiktok.accessToken";
const REFRESH_KEY = "tiktok.refreshToken";

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/** Listeners fired when the session dies (refresh rejected, or logout). */
type SessionEndedListener = () => void;
const sessionEndedListeners = new Set<SessionEndedListener>();

export function onSessionEnded(listener: SessionEndedListener): () => void {
  if (sessionEndedListeners.size === 0) window.addEventListener("storage", onStorage);
  sessionEndedListeners.add(listener);
  return () => {
    sessionEndedListeners.delete(listener);
    if (sessionEndedListeners.size === 0) window.removeEventListener("storage", onStorage);
  };
}

/**
 * Every tab shares one pair, so another tab signing out — or losing its
 * session to a refused refresh — has ended this tab's session too. Without
 * this, the tab kept a signed-in UI whose every request answered 401.
 * `key === null` is another tab clearing storage outright.
 */
function onStorage(event: StorageEvent): void {
  if (event.storageArea !== window.localStorage) return;
  if (event.key !== REFRESH_KEY && event.key !== null) return;
  if (getRefreshToken() !== null) return;
  sessionEndedListeners.forEach((listener) => listener());
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

/**
 * Writes the pair. Called after login and after every rotation — the contract
 * requires the new pair to be persisted *before* any waiting request is
 * replayed, so this must never be deferred behind React state.
 */
export function storeTokens(tokens: TokenPair): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  window.localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
}

/** Drops the pair. `notify` is false when the caller renders the sign-out. */
export function clearTokens({ notify = true }: { notify?: boolean } = {}): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
  if (notify) sessionEndedListeners.forEach((listener) => listener());
}

/**
 * Whether an access token is still good for at least `marginMs`, read off its
 * own `exp` claim. For callers that hand the token to something other than
 * `apiFetch` — the WebSocket handshake — and so get no 401-and-refresh for free.
 *
 * A token whose payload cannot be read counts as fresh: the server is the
 * judge, and guessing "expired" would refresh on every call.
 */
export function isAccessTokenFresh(
  token: string,
  now = Date.now(),
  marginMs = 30_000,
): boolean {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const { exp } = JSON.parse(atob(payload)) as { exp?: unknown };
    return typeof exp !== "number" || exp * 1000 - marginMs > now;
  } catch {
    return true;
  }
}

/**
 * A refresh token alone is still a session: the access token can be gone while
 * the refresh token outlives it, and `apiFetch` mints a new one on the first
 * 401. Reading only the access token made those moments look signed-out to
 * callers like the author cache, which then cached placeholders.
 */
export function hasSession(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}
