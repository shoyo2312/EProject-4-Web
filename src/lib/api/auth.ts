"use client";

import { apiFetch } from "@/lib/api/client";
import { clearTokens, getRefreshToken, storeTokens } from "@/lib/api/tokens";
import type {
  AccountResponse,
  MeResponse,
  OtpSentResponse,
  PasswordResetTicketResponse,
  SignupTicketResponse,
  SocialLoginResponse,
  TokenResponse,
} from "@/lib/api/types";
import type { SocialProvider } from "@/lib/auth/social";

/**
 * What a call that mails a code needs to be let through: a solved Turnstile
 * token, or the `resendTicket` the previous send to the same address answered
 * with (auth-service `OtpSendGate`).
 */
export type SendProof = { turnstileToken: string } | { resendTicket: string };

/** `data` is null from an auth-service that predates the ticket, which is no ticket. */
function codeSent(sent: OtpSentResponse | null): OtpSentResponse {
  return { resendTicket: sent?.resendTicket ?? null };
}

/**
 * `POST /api/v1/auth/register/start` — the email-first signup the modal uses.
 * Mails a code to an address that has no account yet; nothing is created.
 * 409 `EMAIL_ALREADY_EXISTS` for a taken address. Calling it again resends,
 * and the previous code stops working.
 *
 * The first send needs a Turnstile token — auth-service checks it before doing
 * anything else — and a resend can carry the ticket instead.
 */
export async function startSignup(email: string, proof: SendProof): Promise<OtpSentResponse> {
  return codeSent(
    await apiFetch<OtpSentResponse | null>("/auth/register/start", {
      method: "POST",
      body: { email, ...proof },
      auth: "none",
    }),
  );
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
 * `POST /api/v1/auth/email` — authenticated, unlike the rest of the email
 * flow: the account being given an address is the one holding the token, and
 * it has no address to name itself by. An OTP follows, spent at `verify-email`
 * like any other; its resends go through `resendVerification`, with the ticket
 * this answers.
 *
 * `turnstileToken` is required, as on every first send of a code.
 */
export async function addEmail(email: string, turnstileToken: string): Promise<OtpSentResponse> {
  return codeSent(
    await apiFetch<OtpSentResponse | null>("/auth/email", {
      method: "POST",
      body: { email, turnstileToken },
      auth: "required",
    }),
  );
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
 * `POST /api/v1/auth/resend-verification` — the same answer even for unknown
 * emails. Takes a Turnstile token, or the ticket of the previous send.
 */
export async function resendVerification(
  email: string,
  proof: SendProof,
): Promise<OtpSentResponse> {
  return codeSent(
    await apiFetch<OtpSentResponse | null>("/auth/resend-verification", {
      method: "POST",
      body: { email, ...proof },
      auth: "none",
    }),
  );
}

/**
 * `POST /api/v1/auth/forgot-password` — the same answer whether or not the
 * email exists. Takes a Turnstile token, or the ticket of the previous send.
 */
export async function forgotPassword(
  email: string,
  proof: SendProof,
): Promise<OtpSentResponse> {
  return codeSent(
    await apiFetch<OtpSentResponse | null>("/auth/forgot-password", {
      method: "POST",
      body: { email, ...proof },
      auth: "none",
    }),
  );
}

/**
 * `POST /api/v1/auth/reset-password/verify` — spends the reset code and
 * answers the ticket `completePasswordReset` redeems (good for 15 minutes), so
 * a wrong code is refused on the code step. 400 `INVALID_OTP`.
 */
export function verifyPasswordReset(email: string, otp: string): Promise<PasswordResetTicketResponse> {
  return apiFetch<PasswordResetTicketResponse>("/auth/reset-password/verify", {
    method: "POST",
    body: { email, otp },
    auth: "none",
  });
}

/**
 * `POST /api/v1/auth/reset-password/complete` — 204. 400
 * `RESET_SESSION_EXPIRED` means ask for a new code.
 *
 * Every session of the account dies the moment this succeeds, including this
 * device's: the local tokens are dropped here so nothing tries to use a token
 * the server has already invalidated.
 */
export async function completePasswordReset(input: {
  resetToken: string;
  newPassword: string;
}): Promise<void> {
  await apiFetch<void>("/auth/reset-password/complete", {
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
