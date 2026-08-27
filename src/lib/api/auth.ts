"use client";

import { apiFetch } from "@/lib/api/client";
import { clearTokens, getRefreshToken, storeTokens } from "@/lib/api/tokens";
import type {
  MeResponse,
  SocialLoginResponse,
  TokenResponse,
  UserAccount,
} from "@/lib/api/types";
import type { SocialProvider } from "@/lib/auth/social";

/**
 * `POST /api/v1/auth/register` — 201, and the account is NOT usable yet.
 *
 * `turnstileToken` is required — auth-service verifies it before doing
 * anything else, on every call, not just suspicious ones.
 */
export function register(input: {
  username: string;
  email: string;
  password: string;
  turnstileToken: string;
}): Promise<UserAccount> {
  return apiFetch<UserAccount>("/auth/register", {
    method: "POST",
    body: input,
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/login` — stores the pair on success.
 *
 * Throws `EMAIL_NOT_VERIFIED` (403) when the password was right but the email
 * has not been confirmed; that is a different screen, not a different error
 * message, so callers branch on the code rather than showing it.
 */
export async function login(input: {
  usernameOrEmail: string;
  password: string;
}): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse>("/auth/login", {
    method: "POST",
    body: input,
    auth: "none",
  });

  storeTokens({
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
  });

  return tokens;
}

/**
 * `POST /api/v1/auth/oauth/{provider}` — trades a provider token for our JWT
 * pair, and stores it. The account is created on first use, so this call is
 * both "sign up with Google" and "log in with Google"; the two entry points in
 * the UI hit the same endpoint.
 *
 * `requiresEmail` comes back true when the provider gave us no address (a
 * Facebook account can decline the `email` scope). The session is fully usable
 * either way — it is a prompt to collect one later, not a failure.
 */
export async function socialLogin(
  provider: SocialProvider,
  token: string,
): Promise<SocialLoginResponse> {
  const result = await apiFetch<SocialLoginResponse>(
    `/auth/oauth/${provider}`,
    { method: "POST", body: { token }, auth: "none" },
  );

  storeTokens({
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
  });

  return result;
}

/**
 * `POST /api/v1/auth/oauth/{provider}/link` — the second half of a login that
 * came back 409 `SOCIAL_LINK_VERIFICATION_REQUIRED`.
 *
 * The provider token goes back up unchanged: the server re-verifies it, so the
 * merge rests on the provider account *and* the mailed code, never on the
 * client's word. It succeeds into a session, so the pair is stored here too.
 */
export async function confirmSocialLink(
  provider: SocialProvider,
  input: { token: string; otp: string },
): Promise<SocialLoginResponse> {
  const result = await apiFetch<SocialLoginResponse>(
    `/auth/oauth/${provider}/link`,
    { method: "POST", body: input, auth: "none" },
  );

  storeTokens({
    accessToken: result.tokens.accessToken,
    refreshToken: result.tokens.refreshToken,
  });

  return result;
}

/**
 * `POST /api/v1/auth/email` — 204, and authenticated, unlike the rest of the
 * email flow: the account being given an address is the one holding the token,
 * and it has no address to name itself by. An OTP follows, spent at
 * `verify-email` like any other.
 *
 * `turnstileToken` is required, same as every other OTP-issuing call.
 */
export function addEmail(email: string, turnstileToken: string): Promise<void> {
  return apiFetch<void>("/auth/email", {
    method: "POST",
    body: { email, turnstileToken },
    auth: "required",
  });
}

/** `POST /api/v1/auth/verify-email` — 204. Six digits, 15-minute lifetime. */
export function verifyEmail(input: {
  email: string;
  otp: string;
}): Promise<void> {
  return apiFetch<void>("/auth/verify-email", {
    method: "POST",
    body: input,
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/resend-verification` — 204 even for unknown emails.
 *
 * `turnstileToken` is required, same as every other OTP-issuing call.
 */
export function resendVerification(
  email: string,
  turnstileToken: string,
): Promise<void> {
  return apiFetch<void>("/auth/resend-verification", {
    method: "POST",
    body: { email, turnstileToken },
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/forgot-password` — 204 whether or not the email exists.
 *
 * `turnstileToken` is required, same as every other OTP-issuing call.
 */
export function forgotPassword(
  email: string,
  turnstileToken: string,
): Promise<void> {
  return apiFetch<void>("/auth/forgot-password", {
    method: "POST",
    body: { email, turnstileToken },
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/reset-password` — 204.
 *
 * Every session of the account dies the moment this succeeds, including this
 * device's: the local tokens are dropped here so nothing tries to use a token
 * the server has already invalidated.
 */
export async function resetPassword(input: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<void> {
  await apiFetch<void>("/auth/reset-password", {
    method: "POST",
    body: input,
    auth: "none",
  });
  clearTokens({ notify: false });
}

/**
 * `POST /api/v1/auth/logout` — 204. Sends the access token too, which is what
 * gets it blacklisted server-side instead of living out its 15 minutes.
 * Clearing locally happens either way: a failed logout must not strand the
 * viewer in a half-signed-in UI.
 */
export async function logout(): Promise<void> {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await apiFetch<void>("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        auth: "required",
      });
    }
  } finally {
    clearTokens({ notify: false });
  }
}

/** `GET /api/v1/auth/me` — the account, without the social profile. */
export function getAccount(): Promise<UserAccount> {
  return apiFetch<UserAccount>("/auth/me", { auth: "required" });
}

/**
 * `GET /api/v1/me` — the gateway's aggregate of account + profile. One round
 * trip instead of two, and it degrades to `profileReady: false` rather than
 * failing while user-service is still consuming the registration event.
 */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", { auth: "required" });
}
