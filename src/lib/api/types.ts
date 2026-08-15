/**
 * Wire types for the three finished backend services, transcribed from
 * `tiktok-backend/docs/{auth,user,video}-service-api.md`.
 *
 * These are the shapes the gateway actually returns. Nothing in here is a UI
 * type — `lib/api/adapters.ts` is the single place that maps them onto the
 * `types/tiktok.ts` shapes the components render.
 */

/** Every response, success or failure, arrives inside this envelope. */
export interface ApiEnvelope<T> {
  success: boolean;
  data: T | null;
  /** Absent (not null) on success — the server serialises with NON_NULL. */
  code?: string | null;
  message?: string | null;
  timestamp: string;
}

/**
 * The list shape used by user-service and video-service alike. Note the
 * metadata sits inside `page`, not alongside `content`, and that only these
 * four fields exist — Spring's `first`/`last`/`empty` are deliberately not
 * exposed, so derive them (see `isLastPage`).
 */
export interface PageResponse<T> {
  content: T[];
  page: {
    size: number;
    number: number;
    totalElements: number;
    totalPages: number;
  };
}

/**
 * The ONLY correct stop condition for infinite scroll. `content.length` can be
 * shorter than `page.size` on a page that still has successors: user-service
 * drops ids whose profile no longer exists, and video-service pages an
 * offset window over a list that grows at the head.
 */
export function isLastPage(page: PageResponse<unknown>["page"]): boolean {
  return page.number + 1 >= page.totalPages;
}

/* --- auth-service -------------------------------------------------------- */

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "LOCKED";

export interface UserAccount {
  /** Snowflake, as a string — see `lib/api/json.ts` for why never a number. */
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
}

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMillis: number;
}

/**
 * `POST /auth/oauth/{google,facebook}`. `requiresEmail` means the account has
 * no email address yet — the session works, but it cannot reset a password or
 * be reached until one is added.
 */
export interface SocialLoginResponse {
  tokens: TokenResponse;
  requiresEmail: boolean;
}

/* --- user-service -------------------------------------------------------- */

export interface UserProfileResponse {
  userId: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number;
  followingCount: number;
}

export interface FollowResponse {
  followerId: string;
  followingId: string;
}

/* --- api-gateway aggregate ----------------------------------------------- */

/**
 * `GET /api/v1/me` — the gateway's own endpoint, which joins auth-service's
 * account with user-service's profile in one round trip. `profileReady` is
 * false while the `UserRegisteredEvent` has not been consumed yet, in which
 * case every profile field is null instead of the request failing.
 */
export interface MeResponse {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  followerCount: number | null;
  followingCount: number | null;
  profileReady: boolean;
}

/* --- video-service ------------------------------------------------------- */

export type VideoStatus = "PROCESSING" | "PUBLISHED" | "FAILED" | "TAKEN_DOWN";
export type VideoVisibility = "PUBLIC" | "PRIVATE";

export interface VideoResponse {
  /**
   * A 19-digit Snowflake id, carried as a **string**. `userId` is one too:
   * the server sends it as a JSON number, and `lib/api/json.ts` quotes it
   * before parsing, because >2^53 it would silently lose precision.
   */
  id: string;
  userId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  hlsUrl: string | null;
  durationSeconds: number | null;
  status: VideoStatus;
  visibility: VideoVisibility;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  createdAt: string;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  /** Must come from a real upload flow: the server allow-lists host/bucket. */
  rawFileUrl: string;
  visibility: VideoVisibility;
}
