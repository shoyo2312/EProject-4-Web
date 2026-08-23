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
  EMAIL_ALREADY_EXISTS: "An account already exists for that email.",
  INVALID_OTP: "That code is incorrect or has expired.",
  TOO_MANY_OTP_REQUESTS:
    "Too many code attempts. Try again in about 15 minutes.",
  INVALID_SOCIAL_TOKEN: "That sign-in expired. Please try again.",
  EMAIL_ALREADY_LINKED: "This account already has a verified email address.",
  /**
   * Not really an error: the login stopped to mail a code, and the UI puts up
   * the code form instead of a message. Kept here so an unhandled path still
   * reads sensibly.
   */
  SOCIAL_LINK_VERIFICATION_REQUIRED:
    "Enter the code we emailed to confirm this address is yours.",

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

  // video-service
  NOT_VIDEO_OWNER: "You can only delete your own videos.",
  UNSUPPORTED_UPLOAD_TYPE: "That file type isn’t supported. Use MP4, MOV or WebM.",
  UPLOAD_URL_UNAVAILABLE: "Uploads are unavailable right now. Try again shortly.",
  FOREIGN_UPLOAD: "That upload belongs to another account.",
  ALREADY_PUBLISHED: "This file was already posted.",
  UPLOAD_FAILED: "The file couldn’t be uploaded. Try again.",
  VIDEO_NOT_FOUND: "This video is unavailable.",

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
