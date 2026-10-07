/**
 * Backend failures as one throwable, carrying the machine-readable `code` from
 * the envelope. UI decisions branch on `code`, never on `message` — the
 * server's message is English prose meant for logs (see §6 of every contract).
 */
export class ApiError extends Error {
  readonly status: number;
  /** e.g. "EMAIL_NOT_VERIFIED". Null for bare 401s, which carry no code. */
  readonly code: string | null;

  constructor(status: number, code: string | null, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }

  is(code: string): boolean {
    return this.code === code;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

/**
 * The one 409 worth retrying. `CONCURRENT_MODIFICATION` means two writes raced
 * on the same row; every other 409 (`ALREADY_FOLLOWING`, `ALREADY_BLOCKED`, …)
 * is a business outcome that a retry cannot change.
 */
export function isRetryable(error: unknown): boolean {
  return isApiError(error) && error.code === "CONCURRENT_MODIFICATION";
}

/**
 * `code` → text for the viewer. The contracts are explicit that the server's
 * own `message` must not be surfaced, so this is the app's copy, not theirs.
 */
const MESSAGES: Record<string, string> = {
  // auth-service
  VALIDATION_ERROR: "Please check the details you entered.",
  INVALID_CREDENTIALS: "Incorrect account or password.",
  INVALID_REFRESH_TOKEN: "Your session expired. Please log in again.",
  EMAIL_NOT_VERIFIED: "Verify your email address to continue.",
  TOO_MANY_LOGIN_ATTEMPTS:
    "Too many failed attempts. Try again in about 15 minutes.",
  USERNAME_ALREADY_EXISTS: "That username is taken.",
  USERNAME_CHANGE_TOO_SOON: "You can only change your username once every 30 days.",
  EMAIL_ALREADY_EXISTS: "An account already exists for that email.",
  INVALID_OTP: "That code is incorrect or has expired.",
  SIGNUP_SESSION_EXPIRED: "Your sign-up timed out. Please start again.",
  TOO_MANY_OTP_REQUESTS:
    "Too many code attempts. Try again in about 15 minutes.",
  INVALID_SOCIAL_TOKEN: "That sign-in expired. Please try again.",
  /**
   * A stale or already-spent token — a Turnstile widget is always on screen
   * next to the submit that hit this, and `useTurnstileToken.consume()` has
   * already cleared it for a fresh solve by the time this shows.
   */
  TURNSTILE_VERIFICATION_FAILED: "Please complete the verification below and try again.",
  EMAIL_ALREADY_LINKED: "This account already has a verified email address.",
  /**
   * Not really an error: the login stopped to mail a code, and the UI puts up
   * the code form instead of a message. Kept here so an unhandled path still
   * reads sensibly.
   */
  SOCIAL_LINK_VERIFICATION_REQUIRED:
    "Enter the code we emailed to confirm this address is yours.",
  /** Admin accounts: the console's second factor has no social equivalent. */
  SOCIAL_SIGN_IN_NOT_ALLOWED: "This account signs in with its password.",

  // user-service
  CANNOT_FOLLOW_SELF: "You cannot follow yourself.",
  CANNOT_BLOCK_SELF: "You cannot block yourself.",
  CANNOT_MUTE_SELF: "You cannot mute yourself.",
  USER_BLOCKED: "This account is unavailable.",
  USER_PROFILE_NOT_FOUND: "This account is unavailable.",
  ALREADY_FOLLOWING: "You already follow this account.",
  NOT_FOLLOWING: "You do not follow this account.",
  ALREADY_BLOCKED: "You already blocked this account.",
  NOT_BLOCKED: "This account is not blocked.",
  ALREADY_MUTED: "You already muted this account.",
  NOT_MUTED: "This account is not muted.",
  INVALID_AVATAR: "That photo must be a JPEG, PNG, or WebP under 5 MB.",
  DISPLAY_NAME_CHANGE_TOO_SOON: "Your nickname can only be changed once every 7 days.",

  // video-service
  NOT_VIDEO_OWNER: "You can only delete your own videos.",
  UNSUPPORTED_UPLOAD_TYPE: "That file type isn’t supported. Use MP4, MOV or WebM.",
  UPLOAD_URL_UNAVAILABLE: "Uploads are unavailable right now. Try again shortly.",
  FOREIGN_UPLOAD: "That upload belongs to another account.",
  ALREADY_PUBLISHED: "This file was already posted.",
  UPLOAD_FAILED: "The file couldn’t be uploaded. Try again.",
  VIDEO_NOT_FOUND: "This video is unavailable.",

  // interaction-service. Two different 403s on the same button: the owner
  // closed this video's thread, or their account setting excludes this viewer.
  // Saying "turned off" for the second would tell a friends-only viewer that a
  // thread they can see is shut to everyone.
  COMMENTS_DISABLED: "Comments are turned off for this video.",
  COMMENTS_NOT_ALLOWED: "This account doesn’t accept comments from you.",

  // chat-service. MESSAGING_BLOCKED and MESSAGING_NOT_ALLOWED read alike on
  // purpose — a standing audience setting must not be distinguishable from a
  // block, or the copy becomes a way to detect one.
  MESSAGING_BLOCKED: "You cannot message this account.",
  MESSAGING_NOT_ALLOWED: "This account doesn’t accept messages from you.",
  DM_SETTINGS_UNAVAILABLE: "Messaging is unavailable right now. Try again shortly.",

  // search-service. The box stops at SEARCH_MAX_LENGTH; this is for a long
  // term arriving another way, such as a hand-edited /search?q= link.
  QUERY_TOO_LONG: "That search is too long. Try fewer words.",

  // shared
  CONCURRENT_MODIFICATION: "Something changed at the same time. Try again.",
  INTERNAL_ERROR: "Something went wrong. Please try again.",
  NETWORK_ERROR: "Cannot reach the server. Check that the gateway is running.",
};

export function messageFor(error: unknown): string {
  if (!isApiError(error)) return MESSAGES.INTERNAL_ERROR;
  if (error.code && MESSAGES[error.code]) return MESSAGES[error.code];
  if (error.status === 401) return MESSAGES.INVALID_REFRESH_TOKEN;
  if (error.status === 429) return "Too many requests. Please slow down.";
  return MESSAGES.INTERNAL_ERROR;
}
