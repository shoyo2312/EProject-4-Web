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

export interface TokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresInMillis: number;
}

/** `POST /auth/register/verify` — proof the mailbox was verified. */
export interface SignupTicketResponse {
  signupToken: string;
  expiresInMillis: number;
}

/** `POST /auth/reset-password/verify` — proof the reset code was right. */
export interface PasswordResetTicketResponse {
  resetToken: string;
  expiresInMillis: number;
}

/**
 * What every call that mails a code answers. `resendTicket` goes in place of
 * the Turnstile token on the next send to the same address in the same flow,
 * for 15 minutes from the check that earned it. Null when the server gave
 * none, and the next send needs Turnstile again.
 */
export interface OtpSentResponse {
  resendTicket: string | null;
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

/**
 * auth-service's `UserResponse` — the account itself, as `PUT /auth/me/username`
 * answers it.
 */
export interface AccountResponse {
  id: string;
  username: string;
  email: string | null;
  role: UserRole;
  status: UserStatus;
  emailVerified: boolean;
  createdAt: string;
  /** When the handle may change again; null when it may change now. */
  usernameChangeableAt: string | null;
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
  /**
   * When the display name may change again. Only on the owner's own profile:
   * null for everyone else, and for the owner when it may change now.
   */
  displayNameChangeableAt?: string | null;
}

export interface FollowResponse {
  followerId: string;
  followingId: string;
  /** REQUESTED when the account is private and its owner has to approve first. */
  status: "FOLLOWING" | "REQUESTED";
}

/** `GET /users/{id}/friendship` — the viewer's relationship to one account. */
export interface FriendshipResponse {
  userId: string;
  /** Mutual following. */
  friends: boolean;
  following: boolean;
  /** A follow request from the viewer is waiting on the owner's approval. */
  requested: boolean;
  privateAccount: boolean;
}

/** Who may comment on, or message, an account. `FRIENDS` is mutual followers. */
export type SettingsAudience = "EVERYONE" | "FRIENDS" | "NO_ONE";

/**
 * `GET /api/v1/users/me/settings` — never 404: an account that never changed a
 * setting reads the defaults. Null on the screen-time fields means off.
 */
export interface UserSettingsResponse {
  commentAudience: SettingsAudience;
  dmAudience: SettingsAudience;
  /** 10–480, the same limit every day. Null when off or when the limit is set per day. */
  screenTimeLimitMinutes: number | null;
  /** Seven limits of 10–480, Monday first. Null unless the limit is set per day. */
  screenTimeLimitsByDay: number[] | null;
  /** The passcode itself is write-only; this says whether one is set. */
  hasScreenTimePasscode: boolean;
  /** "HH:mm" wall-clock with no timezone, or null when sleep hours are off. */
  sleepHoursStart: string | null;
  /** Always the start plus eight hours, worked out by the server. */
  sleepHoursEnd: string | null;
  weeklyScreenTimeDigest: boolean;
  /**
   * Kept on the profile, switched here. On, only approved followers see the
   * videos; turning it off approves every request still waiting.
   */
  privateAccount: boolean;
  /**
   * The owner's comment filters, applied by interaction-service to each new
   * comment under their videos: a match is held for their review, never
   * refused. Spam and offensive off lets through what is only profane,
   * insulting or spammy — never hate, threats or scams.
   */
  filterSpamOffensive: boolean;
  filterAllComments: boolean;
  /** Replaced whole by a PATCH. At most 50, each 1–30 code points. */
  commentKeywords: string[];
  /** Push notifications → Interactions: what may raise a push or a desktop notification. */
  pushLikes: boolean;
  pushComments: boolean;
  pushNewFollowers: boolean;
  /** Push notifications → In-app notifications: what may raise a banner on an open tab. */
  inAppLikes: boolean;
  inAppComments: boolean;
  inAppNewFollowers: boolean;
  inAppReposts: boolean;
  /** The IANA zone the last screen-time heartbeat came from. Null until there has been one. */
  timeZone: string | null;
}

/**
 * `PATCH /api/v1/users/me/settings`: any of the settings, less the three the
 * server works out itself, plus the write-only four-digit passcode.
 */
export type UserSettingsPatch = Partial<
  Omit<UserSettingsResponse, "hasScreenTimePasscode" | "timeZone" | "sleepHoursEnd">
> & { screenTimePasscode?: string };

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
  /**
   * Null when the account came from a social login the provider gave no
   * address for. Nothing forces one to exist — `POST /auth/email` is how one
   * arrives later — so every reader has to cope with its absence.
   */
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
  /**
   * When the handle (once every 30 days) and the display name (once every 7)
   * may change again; null when they may change now. A gateway older than these
   * fields leaves them out, which reads the same as null.
   */
  usernameChangeableAt?: string | null;
  displayNameChangeableAt?: string | null;
  /**
   * False for a social account that has never set a password. Left out by a
   * gateway older than the field, which reads as true: nothing is offered.
   */
  hasPassword?: boolean;
  /**
   * Whether `email` is proven, and the providers linked to the account
   * (`GOOGLE`, `FACEBOOK`): together with `hasPassword`, how the owner
   * reconfirms before closing the account. Left out by an older gateway.
   */
  emailVerified?: boolean;
  providers?: string[];
}

/** `POST /auth/account/delete`: the account is deleted then, unless its owner logs in first. */
export interface DeletionScheduledResponse {
  deletionScheduledAt: string;
}

/* --- video-service ------------------------------------------------------- */

/**
 * Only `PUBLISHED` is watchable. The two `PENDING_*` states are the automatic
 * moderation pass that sits between transcoding and publication: a video is
 * never on a feed before a verdict, and a verdict that could not be reached
 * sends it to a human rather than publishing it.
 *
 * `REJECTED` is the classifier's own removal, `TAKEN_DOWN` an admin's. Both are
 * reversible by an admin; only the owner ever sees either.
 */
export type VideoStatus =
  | "PROCESSING"
  | "PENDING_MODERATION"
  | "PENDING_REVIEW"
  | "PUBLISHED"
  | "FAILED"
  | "REJECTED"
  | "TAKEN_DOWN";
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
  /**
   * Null when `commentsDisabled` or `accountCommentsOff` — a video with comments
   * off exposes no comment total.
   */
  commentCount: number | null;
  /**
   * The video's own switch: the owner turned comments off for this video.
   * interaction-service then rejects new comments.
   */
  commentsDisabled: boolean;
  /**
   * The owner's account accepts comments from no one, which closes every video
   * they own — to everyone, the owner included — whatever the video's own
   * switch says.
   */
  accountCommentsOff: boolean;
  /** Why the transcode failed; present only when `status === "FAILED"`. */
  failureReason?: string | null;
  /**
   * The size a player should show the video at, corrected for rotation. Null
   * while transcoding, when the file could not be measured, or for videos
   * uploaded before this field existed — fall back to portrait, not zero.
   */
  width: number | null;
  height: number | null;
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

/**
 * `GET /api/v1/recommendations/trending` — the last 24 hours' chart, the same
 * for every viewer. Ids in rank order, hydrated like the feed; `score` decays
 * by the hour and means something only against the other rows it came with.
 */
export interface TrendingVideoResponse {
  videoId: string;
  score: number;
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
 * `GET /interactions/videos/counts/batch` — interaction-service's counters, the
 * source of truth for all of them, and the only place shares and saves are
 * counted at all: `VideoResponse` carries neither.
 */
export interface InteractionCountResponse {
  videoId: string;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  viewCount: number;
  saveCount: number;
  repostCount: number;
}

/** Repost is a toggle, like a like — not an event log like a share. */
export interface RepostStatusResponse {
  videoId: string;
  reposted: boolean;
  repostCount: number;
}

/**
 * What the repost badge renders from. `reposterIds` is a capped, unordered sample of
 * who reposted the video; the client keeps whichever of them the viewer follows.
 */
export interface RepostContextResponse {
  videoId: string;
  repostedByMe: boolean;
  reposterIds: string[];
}

/**
 * A comment as interaction-service stores it. `userId` is all it knows about
 * the author — the client resolves a name and avatar itself via `resolveAuthor`.
 * `parentId` is `null` for a top-level comment and the top-level comment's id
 * for a reply (TikTok nests exactly one level); the two live behind separate
 * endpoints, `listComments` and `listReplies`.
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
  /** Live replies behind "View N replies". Always 0 on a reply — nesting is one level deep. */
  replyCount: number;
  /**
   * `HELD`: the text rules kept this comment for the video's owner to approve —
   * in no listing and no count until then. An interaction-service older than
   * text moderation leaves it out, which reads as `VISIBLE`.
   */
  status?: "VISIBLE" | "HELD";
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

/**
 * `GET /interactions/videos/{videoId}/comment-permission` — why the caller may
 * not comment, or null when they may. The same rule that refuses the post, so
 * hiding the composer on it never disagrees with the 403 it replaces.
 * `COMMENTING_RESTRICTED` is about the caller, not the video: too many of
 * their comments were refused or removed lately.
 */
export type CommentRestriction =
  | "COMMENTS_DISABLED"
  | "NO_ONE"
  | "FRIENDS_ONLY"
  | "COMMENTING_RESTRICTED";

export interface CommentPermissionResponse {
  restriction: CommentRestriction | null;
  /** ISO-8601, when `COMMENTING_RESTRICTED` lifts; null with any other answer. */
  restrictedUntil: string | null;
}

/* --- search-service ------------------------------------------------------ */

/**
 * `GET /api/v1/search/videos` — one hit from the Elasticsearch projection, not
 * a `VideoResponse`. It is built from Kafka events, so it carries only what
 * those events published: no `hlsUrl` (a tile shows the poster and links to the
 * detail page, which fetches the playable video), no visibility (the index only
 * ever holds PUBLISHED videos), and `description`/`tags` only for videos
 * published after those fields were added to `VideoPublishedEvent`.
 */
export interface VideoSearchResponse {
  id: string;
  userId: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  status: VideoStatus;
  /** Normalised by video-service: lowercase, no leading `#`. Empty when untagged. */
  tags: string[];
  viewCount: number;
  likeCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: string;
}

/** Where a story is in moderation — see `tiktok-backend/docs/story-service-api.md` §1. */
export type StoryStatus = "PENDING_MODERATION" | "ACTIVE" | "HELD" | "REJECTED";

export type StoryMediaType = "IMAGE" | "VIDEO";

/** The same three audiences, with the same meaning, as a video's. */
export type StoryVisibility = VideoVisibility;

export interface StoryResponse {
  id: string;
  userId: string;
  /** A presigned GET that lives one hour — fetch the story again for a fresh one. */
  mediaUrl: string | null;
  mediaType: StoryMediaType;
  caption: string | null;
  visibility: StoryVisibility;
  /** The owner's own view only; null for everyone else, who only ever sees ACTIVE stories. */
  status: StoryStatus | null;
  durationSeconds: number | null;
  /** The owner's own view only. */
  viewCount: number | null;
  viewedByMe: boolean;
  createdAt: string;
  expiresAt: string;
}

/** One bubble in the tray: an owner's live stories, oldest first — the order they play in. */
export interface StoryGroup {
  userId: string;
  stories: StoryResponse[];
  /**
   * Whether the viewer has a story of this owner left to watch. For the viewer's own group the feed
   * always sends false, while a group built with `ringStateOf` has it true as long as one of their
   * stories is ACTIVE: take the own ring from `ringStateOf`, not from this.
   */
  hasUnseen: boolean;
}

/** An avatar's ring. Accounts with no story the viewer may watch are left out of the answer, not listed. */
export interface StoryRing {
  userId: string;
  /** Always true for a guest. For the viewer's own account: true iff one of their stories is ACTIVE. */
  hasUnseen: boolean;
}

export interface StoryViewer {
  viewerId: string;
  viewedAt: string;
}
