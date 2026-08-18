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
  sessionEndedListeners.add(listener);
  return () => sessionEndedListeners.delete(listener);
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
 * A refresh token alone is still a session: the access token can be gone while
 * the refresh token outlives it, and `apiFetch` mints a new one on the first
 * 401. Reading only the access token made those moments look signed-out to
 * callers like the author cache, which then cached placeholders.
 */
export function hasSession(): boolean {
  return getAccessToken() !== null || getRefreshToken() !== null;
}
