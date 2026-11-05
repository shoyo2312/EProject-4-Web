"use client";

import { ApiError, parseRetryAfter } from "@/lib/api/errors";
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  storeTokens,
} from "@/lib/api/tokens";
import { parseJsonPreservingIds } from "@/lib/api/json";
import type { ApiEnvelope, TokenResponse } from "@/lib/api/types";

/**
 * The one place that talks to the backend.
 *
 * Same-origin: `/api/*` is proxied to the gateway by `next.config.ts`, so no
 * call site ever names a service port. Everything below implements the rules
 * the contracts spell out — envelope unwrapping, bearer headers, and the
 * refresh dance, which is the part that bites hardest if you get it wrong.
 */

const BASE = "/api/v1";

/**
 * - `required`: send the token; a 401 triggers one refresh + one replay.
 * - `optional`: send it if we have one. video-service's GETs read it to decide
 *   whether you may see your own PROCESSING/PRIVATE videos. An expired token
 *   still gets a 401 there — the gateway refuses a bad token on public paths
 *   too rather than serve a guest — so it takes the same one refresh + one
 *   replay as `required`. Only a request with no token at all is a guest.
 * - `none`: never send it (login, register, refresh…).
 */
type AuthMode = "required" | "optional" | "none";

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: AuthMode;
  query?: Record<string, string | number | boolean | undefined>;
  signal?: AbortSignal;
  /** Lets the request outlive the page, for telemetry sent on the way out. */
  keepalive?: boolean;
}

export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = "GET", body, auth = "optional", query, signal, keepalive } = options;

  const url = BASE + path + buildQuery(query);
  const token = auth === "none" ? null : getAccessToken();

  let response = await send(url, method, body, token, signal, keepalive);

  /**
   * A 401 on an authenticated call means the 15-minute access token is gone.
   * Refresh **once**, replay **once**. The retry uses the token that
   * `refreshAccessToken` has already persisted, never the one captured above.
   *
   * A refresh token with no access token beside it is the ordinary bootstrap
   * shape — the access token expired and was dropped — so the refresh must be
   * reachable without one. Gating on `token` signed those sessions out on load.
   * A visitor holding neither is a guest, not an expired session, so that case
   * falls through to the server's own 401 instead.
   */
  if (
    response.status === 401 &&
    auth !== "none" &&
    (token || getRefreshToken())
  ) {
    const fresh = await refreshAccessToken();
    if (!fresh) {
      throw new ApiError(401, "INVALID_REFRESH_TOKEN", "Session expired");
    }
    response = await send(url, method, body, fresh, signal, keepalive);
  }

  return unwrap<T>(response);
}

function buildQuery(query: RequestOptions["query"]): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined) params.set(key, String(value));
  }
  const rendered = params.toString();
  return rendered ? `?${rendered}` : "";
}

async function send(
  url: string,
  method: string,
  body: unknown,
  token: string | null,
  signal?: AbortSignal,
  keepalive?: boolean,
): Promise<Response> {
  // FormData carries its own multipart boundary in the Content-Type the browser
  // writes, so setting the header here would produce a boundary-less type the
  // server cannot parse.
  const isMultipart = body instanceof FormData;

  const headers: Record<string, string> = {};
  if (body !== undefined && !isMultipart) {
    headers["Content-Type"] = "application/json";
  }
  if (token) headers.Authorization = `Bearer ${token}`;

  try {
    return await fetch(url, {
      method,
      headers,
      body:
        body === undefined
          ? undefined
          : isMultipart
            ? (body as FormData)
            : JSON.stringify(body),
      signal,
      keepalive,
    });
  } catch (cause) {
    if (signal?.aborted) throw cause;
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the API gateway");
  }
}

/** Envelope in, payload out — or an `ApiError` carrying the envelope's code. */
async function unwrap<T>(response: Response): Promise<T> {
  // 204 is a real success shape here: logout, verify-email, reset-password…
  if (response.status === 204) return null as T;

  const text = await response.text();
  // A rate limit says when to try again; the send button waits exactly that long.
  const retryAfter = parseRetryAfter(response.headers.get("Retry-After"));
  if (!text) {
    if (response.ok) return null as T;
    throw new ApiError(response.status, null, response.statusText, retryAfter);
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = parseJsonPreservingIds<ApiEnvelope<T>>(text);
  } catch {
    // Not our envelope — a gateway-level error page, most likely.
    throw new ApiError(response.status, null, response.statusText, retryAfter);
  }

  if (!response.ok || envelope.success === false) {
    throw new ApiError(
      response.status,
      envelope.code ?? null,
      envelope.message ?? response.statusText,
      retryAfter,
    );
  }

  return envelope.data as T;
}

/* --- refresh ------------------------------------------------------------- */

/**
 * The single-flight latch. Refresh tokens **rotate on every use**: two parallel
 * `/refresh` calls with the same token mean the second one presents a token
 * that was just rotated, which the server reads as a stolen token and answers
 * by killing every session the account has, on every device. So concurrent
 * 401s must all await this one promise.
 */
let inFlightRefresh: Promise<string | null> | null = null;

const REFRESH_TIMEOUT_MS = 15_000;

/** Refresh answers that mean the token itself was rejected: invalid, revoked, or the account barred. */
const SESSION_OVER_STATUSES = new Set([400, 401, 403]);

export function refreshAccessToken(): Promise<string | null> {
  if (inFlightRefresh) return inFlightRefresh;

  // The latch above is per tab, but every tab shares one pair — and chat-service closes every
  // tab's socket in the same sweep when the shared access token expires, so they all refresh at
  // once. The loser presented the spent token, got a 401, and cleared the winner's fresh pair,
  // signing every tab out. A cross-tab lock serialises them; whoever waited finds the pair
  // already rotated and uses it.
  const seen = getRefreshToken();
  const run = () =>
    getRefreshToken() !== seen ? Promise.resolve(getAccessToken()) : performRefresh();

  // ponytail: Web Locks only exists in secure contexts; over plain http on a LAN IP the tabs fall
  // back to racing as before. `Promise.resolve` only flattens the type: lib.dom types `request`
  // as resolving to the callback's promise, while it really resolves to that promise's value.
  inFlightRefresh = Promise.resolve(
    "locks" in navigator ? lockedRefresh(run) : run(),
  ).finally(() => {
    inFlightRefresh = null;
  });

  return inFlightRefresh;
}

/**
 * `locks` can exist and still refuse (SecurityError in sandboxed or opaque-origin frames). Every
 * refresh then failed and the session quietly died at its next expiry, so a refused lock runs the
 * refresh unlocked. Only the lock's own refusal falls back: a failed refresh is not retried.
 */
async function lockedRefresh(run: () => Promise<string | null>): Promise<string | null> {
  let started = false;
  try {
    return await navigator.locks.request("tiktok.refresh", () => {
      started = true;
      return run();
    });
  } catch (cause) {
    if (started) throw cause;
    return run();
  }
}

/**
 * Returns the new access token, or null when the session is over. Throws
 * `ApiError` when the refresh could not be answered (network, 5xx, 429) — the
 * session may well still be alive, so the tokens stay. Never retries: a second
 * attempt lands outside the server's 10-second grace window and *is* the
 * replay that logs the user out everywhere.
 */
async function performRefresh(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    clearTokens();
    return null;
  }

  let response: Response;
  try {
    response = await fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken }),
      // A hung request would hold the cross-tab lock, and with it every tab's refresh and socket.
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    // The network dropped; the session itself is probably still fine, so the
    // tokens stay put and the caller reports a network failure.
    throw new ApiError(0, "NETWORK_ERROR", "Cannot reach the API gateway");
  }

  // Only the server refusing the token ends the session. A 5xx while
  // auth-service restarts, or the gateway's per-IP 429, says nothing about the
  // token — clearing on those signed the viewer out of a perfectly good session.
  if (SESSION_OVER_STATUSES.has(response.status)) {
    return endSession(refreshToken);
  }
  if (!response.ok) {
    throw new ApiError(response.status, null, response.statusText);
  }

  let envelope: ApiEnvelope<TokenResponse>;
  try {
    envelope = parseJsonPreservingIds<ApiEnvelope<TokenResponse>>(await response.text());
  } catch {
    // Not our envelope — a proxy page. Says nothing about the token, so the tokens stay.
    throw new ApiError(response.status, null, response.statusText);
  }
  if (!envelope.success || !envelope.data) {
    return endSession(refreshToken);
  }

  // Persisted here, synchronously, before any waiting request is replayed.
  storeTokens({
    accessToken: envelope.data.accessToken,
    refreshToken: envelope.data.refreshToken,
  });

  return envelope.data.accessToken;
}

/**
 * The refused token is gone, but the pair may already have been replaced while the request was in
 * flight — a sign-in in another tab, or a tab without Web Locks that won the rotation. Clearing then
 * would wipe that fresh pair and sign every tab out.
 */
function endSession(sent: string): string | null {
  if (getRefreshToken() !== sent) return getAccessToken();
  clearTokens();
  return null;
}
