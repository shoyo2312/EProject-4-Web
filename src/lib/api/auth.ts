"use client";

import { apiFetch } from "@/lib/api/client";
import { clearTokens, getRefreshToken, storeTokens } from "@/lib/api/tokens";
import type {
  AccountResponse,
  MeResponse,
  SignupTicketResponse,
  SocialLoginResponse,
  TokenResponse,
} from "@/lib/api/types";
import type { SocialProvider } from "@/lib/auth/social";

/**
 * `POST /api/v1/auth/register/start` — the email-first signup the modal uses.
 * Mails a code to an address that has no account yet; nothing is created.
 * 409 `EMAIL_ALREADY_EXISTS` for a taken address. Calling it again resends,
 * and the previous code stops working.
 *
 * `turnstileToken` is required — auth-service verifies it before doing
 * anything else, on every call, not just suspicious ones.
 */
export function startSignup(email: string, turnstileToken: string): Promise<void> {
  return apiFetch<void>("/auth/register/start", {
    method: "POST",
    body: { email, turnstileToken },
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/register/verify` — spends the code and answers the
 * ticket `completeSignup` redeems (good for 30 minutes).
 */
export function verifySignup(email: string, otp: string): Promise<SignupTicketResponse> {
  return apiFetch<SignupTicketResponse>("/auth/register/verify", {
    method: "POST",
    body: { email, otp },
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/register/complete` — creates the account, already
 * verified, and signs it in, so the pair is stored here like `login`'s.
 * 409 `USERNAME_ALREADY_EXISTS` leaves the ticket usable; 400
 * `SIGNUP_SESSION_EXPIRED` means start again from the email.
 */
export async function completeSignup(input: {
  signupToken: string;
  username: string;
  password: string;
}): Promise<TokenResponse> {
  const tokens = await apiFetch<TokenResponse>("/auth/register/complete", {
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

/**
 * `GET /api/v1/me` — the gateway's aggregate of account + profile. One round
 * trip instead of two, and it degrades to `profileReady: false` rather than
 * failing while user-service is still consuming the registration event.
 */
export function getMe(): Promise<MeResponse> {
  return apiFetch<MeResponse>("/me", { auth: "required" });
}

/**
 * `PUT /api/v1/auth/me/username` — a new handle, once every 30 days.
 * 409 `USERNAME_ALREADY_EXISTS`, 429 `USERNAME_CHANGE_TOO_SOON`. The current
 * handle is a no-op that spends nothing.
 *
 * user-service learns of the change through Kafka, so for a few seconds
 * `/users/by-username/{new}` can still 404: route to the viewer's own page from
 * the session, not by looking the new handle up.
 */
export function changeUsername(username: string): Promise<AccountResponse> {
  return apiFetch<AccountResponse>("/auth/me/username", {
    method: "PUT",
    body: { username },
    auth: "required",
  });
}
