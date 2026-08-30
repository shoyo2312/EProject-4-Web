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

/**
 * The feed's own page shape — positioned by what the last page ended on, not by
 * how many pages preceded it. There is no total and no page number: `nextCursor`
 * is passed back verbatim, and its being null is the end of the feed. That is
 * the whole protocol, so `isLastPage` does not apply here.
 */
export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

/* --- auth-service -------------------------------------------------------- */

export type UserRole = "USER" | "ADMIN";
export type UserStatus = "ACTIVE" | "LOCKED";

export interface UserAccount {
  /** Snowflake, as a string — see `lib/api/json.ts` for why never a number. */
  id: string;
  username: string;
  /**
   * Null when the account came from a social login the provider gave no
   * address for. Nothing forces one to exist — `POST /auth/email` is how one
   * arrives later — so every reader has to cope with its absence.
   */
  email: string | null;
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
  /**
   * The account's handle. Null for accounts created before user-service began copying it off
   * the registration event, so never render it without a fallback.
   */
  username: string | null;
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
  /** Null for the same reason as `UserAccount.email`. */
  email: string | null;
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
export type VideoVisibility = "PUBLIC" | "FRIENDS" | "PRIVATE";

/** The profile header's counters — `GET /videos/users/{userId}/stats`. */
export interface UserVideoStatsResponse {
  userId: string;
  videoCount: number;
  /** Likes summed over the creator's videos. The owner's own hidden videos count for them only. */
  totalLikes: number;
  totalViews: number;
}

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
  /** Null when `commentsDisabled` — a video with comments off exposes no comment total. */
  commentCount: number | null;
  /** The owner turned comments off; interaction-service then rejects new comments. */
  commentsDisabled: boolean;
  /** Why the transcode failed; present only when `status === "FAILED"`. */
  failureReason?: string | null;
  createdAt: string;
}

/**
 * `POST /api/v1/videos/upload-url` — asks video-service to presign a multipart
 * POST the browser sends the file to directly, so the bytes never cross the gateway.
 */
export interface UploadUrlRequest {
  /** MIME type of the file. Only `video/mp4`, `video/quicktime` and `video/webm`. */
  contentType: string;
}

export interface UploadUrlResponse {
  /** The bucket URL to POST the multipart form to. Expires — upload straight away. */
  uploadUrl: string;
  /** Every field the multipart POST must carry. Append these, then the file last. */
  formFields: Record<string, string>;
  /** The `s3://` location to send back as `rawFileUrl` once the POST succeeds. */
  fileUrl: string;
  expiresInSeconds: number;
}

export interface CreateVideoRequest {
  title: string;
  description?: string;
  /** Must come from a real upload flow: the server allow-lists host/bucket. */
  rawFileUrl: string;
  visibility: VideoVisibility;
}

/* --- recommendation-service ---------------------------------------------- */

/**
 * `GET /api/v1/recommendations/feed` — a **ranking**, not videos. This service
 * has no read path into video-service's data, so it returns ids and the client
 * hydrates them (`getVideosByIds`). The order is the ranking and must survive.
 *
 * There is no page parameter: the server remembers what it served this viewer
 * for 30 minutes and excludes it, so asking again *is* the next page. It runs
 * out — the candidate pool is finite — and answers `[]`, which is the signal to
 * fall back to the chronological feed rather than an error.
 */
export interface FeedItemResponse {
  videoId: string;
  score: number;
  /** Why this video ranked: `trending`, `tag:<name>`, `model`. Debug aid. */
  reasons: string[];
}

/* --- interaction-service -------------------------------------------------- */

/**
 * `POST /api/v1/interactions/videos/{videoId}/watch`. One row of training data
 * per viewing session, sent once when playback ends — not per progress tick.
 *
 * `watchedMs` is time actually played, summed across replays, so a looping clip
 * reports more than its own length. `durationMs` is what the player saw, sent
 * alongside rather than looked up: what matters is the fraction of what was
 * playable, and the two can disagree while a re-transcode is in flight.
 */
export interface ViewResponse {
  videoId: string;
  /** False when the same viewer already counted for this video inside the window. */
  counted: boolean;
  /** The count after this call — the value to render, not a delta to add. */
  viewCount: number;
}

export interface WatchResponse {
  videoId: string;
  /** What the server stored — the reported figure, clamped to the video's length. */
  watchedMs: number;
  /** Whether this counted as watching to the end. The threshold is server-side. */
  completed: boolean;
}

export interface LikeStatusResponse {
  videoId: string;
  liked: boolean;
  likeCount: number;
}

export interface SaveStatusResponse {
  videoId: string;
  /** Whether the *viewer* has this video in their favourites — it is private to them. */
  saved: boolean;
}

/**
 * A page of the viewer's own likes or saves. Ids only: interaction-service
 * stores no video metadata, so the ids are handed to `getVideosByIds` to become
 * something renderable.
 */
export interface VideoIdPageResponse {
  videoIds: string[];
  nextCursor: string | null;
  hasMore: boolean;
}

export interface ShareResponse {
  shareId: string;
  videoId: string;
  shareCount: number;
}

/**
 * A comment as interaction-service stores it: one flat list per video with no
 * per-comment like count. `userId` is all it knows about the author — the
 * client resolves a name and avatar itself via `resolveAuthor`. Replies live in
 * the same list; `parentId` is `null` for a top-level comment and the top-level
 * comment's id for a reply (TikTok nests exactly one level).
 */
export interface CommentResponse {
  commentId: string;
  videoId: string;
  userId: string;
  content: string;
  createdAt: string;
  parentId: string | null;
  /** Set only when this reply targets another reply — its author, for the "A > B" label. */
  replyToUserId: string | null;
  likeCount: number;
  /** Whether the requesting user has liked it — always false for an unauthenticated listing. */
  likedByMe: boolean;
}

/** `POST` / `DELETE .../comments/{commentId}/like` — the new state plus the denormalised tally. */
export interface CommentLikeResponse {
  commentId: string;
  liked: boolean;
  likeCount: number;
}

/** `GET .../comments` — cursor paged like the feed, but also reports `hasMore`. */
export interface CommentPageResponse {
  items: CommentResponse[];
  nextCursor: string | null;
  hasMore: boolean;
}
