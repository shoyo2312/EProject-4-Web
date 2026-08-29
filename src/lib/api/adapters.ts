import type { MeResponse, UserProfileResponse, VideoResponse } from "@/lib/api/types";
import type { Author, FeedVideo, ProfileVideo, UserProfile } from "@/types/tiktok";

/**
 * Backend DTOs → the UI shapes in `types/tiktok.ts`. Every mismatch between
 * what the services return and what the cloned UI renders is resolved here and
 * nowhere else, so components stay unaware of the wire format.
 *
 * Three gaps are worth knowing about, because they are backend limitations
 * rather than choices made here:
 *
 *  1. **user-service has no handle.** A profile carries `displayName` but no
 *     username, and there is no lookup-by-username endpoint. So a backend
 *     account's route handle is its numeric id — `/@123456789012345` — which
 *     resolves through `GET /users/{userId}`. Only the signed-in viewer knows
 *     their own username, which comes from auth-service.
 *  2. **No media dimensions or duration until transcoding lands.** The card
 *     needs an aspect ratio to size itself, so portrait 1080×1920 is assumed
 *     until `durationSeconds` and a thumbnail exist.
 *  3. **No music, no bookmark counter, no baseline share counter.** Bookmarking
 *     has no backing service at all. Sharing does — interaction-service records
 *     it — but `VideoResponse` carries no denormalized share count the way it
 *     does like/comment counts, so `shares` starts at 0 here and the UI adds
 *     this-session's shares on top (`ActionRail`, `VideoDetail`).
 */

/** The route segment for a backend account: its id, since there is no handle. */
export function handleFor(userId: string): string {
  return userId;
}

/** True when a `/@…` segment addresses a backend account rather than mock data. */
export function isBackendHandle(handle: string): boolean {
  return /^\d+$/.test(handle);
}

/**
 * The "@handle" to show in a header or list row, or null when there isn't a
 * real one to show. `author.handle` is the auth-service handle; `username` is
 * only a usable fallback for mock authors — on a backend account it is the
 * numeric id, which is never what a reader wants to see.
 */
export function displayHandle(
  author: Pick<Author, "username" | "handle">,
): string | null {
  return author.handle ?? (isBackendHandle(author.username) ? null : author.username);
}

/**
 * Shown wherever an account has no avatar of its own — user-service leaves
 * `avatarUrl` null until someone uploads one. Exported because the same picture
 * has to stand in outside this module (the nav's own row, an author lookup that
 * failed); a second literal elsewhere is how one of them ends up stale.
 */
export const DEFAULT_AVATAR = "/images/avatars/avatar-default.png";

export function authorFromProfile(profile: UserProfileResponse): Author {
  return {
    userId: profile.userId,
    username: handleFor(profile.userId),
    handle: profile.username ?? undefined,
    nickname: profile.displayName ?? `user${profile.userId}`,
    avatarUrl: profile.avatarUrl ?? DEFAULT_AVATAR,
  };
}

/**
 * The viewer themself. Unlike anybody else they have a real handle, from
 * auth-service, so their profile page lives at `/@theirname`.
 */
export function authorFromMe(me: MeResponse): Author {
  return {
    userId: me.id,
    username: me.username,
    handle: me.username,
    nickname: me.displayName ?? me.username,
    avatarUrl: me.avatarUrl ?? DEFAULT_AVATAR,
  };
}

/** Stand-in for an author whose profile could not be read (guest, or blocked). */
export function unknownAuthor(userId: string): Author {
  return {
    userId,
    username: handleFor(userId),
    nickname: `user${userId}`,
    avatarUrl: DEFAULT_AVATAR,
  };
}

export function videoToFeedVideo(
  video: VideoResponse,
  author: Author,
  options: { isFollowing?: boolean } = {},
): FeedVideo {
  return {
    id: video.id,
    author,
    title: video.title,
    description: video.description ?? "",
    music: {
      title: `original sound - ${author.nickname}`,
      author: author.nickname,
      coverUrl: author.avatarUrl,
    },
    stats: {
      likes: video.likeCount,
      // Null when the owner turned comments off — `commentsDisabled` is what the UI reads then.
      comments: video.commentCount ?? 0,
      // See the module doc: bookmarks have no source at all; shares does,
      // but not as a count on this DTO — the UI tracks it from a 0 baseline.
      bookmarks: 0,
      shares: 0,
    },
    // Empty until transcoding produces the HLS manifest — VideoCard falls back
    // to a poster-only card, which is exactly the PROCESSING state.
    videoUrl: video.hlsUrl ?? "",
    width: 1080,
    height: 1920,
    // Same reason as `videoToProfileVideo`: video-service has no thumbnails
    // yet, and one shared fallback made every card in the feed the same
    // picture. Empty means "no poster" — `VideoCard` handles it.
    posterUrl: video.thumbnailUrl ?? "",
    durationSeconds: video.durationSeconds ?? 0,
    isFollowing: options.isFollowing ?? false,
    hasTranslation: false,
    visibility: video.visibility,
    commentsDisabled: video.commentsDisabled,
  };
}

/**
 * No stand-in poster on purpose. video-service returns `thumbnailUrl: null`
 * for everything it has transcoded so far, and one shared fallback image made
 * every tile in the grid the same picture. Empty instead, which `ProfileTile`
 * reads as "let the browser draw the first frame".
 */
export function videoToProfileVideo(video: VideoResponse): ProfileVideo {
  return {
    id: video.id,
    posterUrl: video.thumbnailUrl ?? "",
    videoUrl: video.hlsUrl ?? "",
    views: video.viewCount,
    isPrivate: video.visibility === "PRIVATE",
  };
}

/**
 * A profile page from what the backend can actually supply.
 *
 * `isVerified` does not exist as a concept in user-service, and the reposts tab has no
 * service behind it, so it renders empty rather than borrowing mock content that would be a
 * lie. `likes` is video-service's aggregate, and favourites/liked are filled in by
 * `BackendProfilePage` when their tab is opened.
 */
export function profileToUserProfile(
  profile: UserProfileResponse,
  author: Author,
  videos: ProfileVideo[],
  options: { isFollowing?: boolean; totalLikes?: number } = {},
): UserProfile {
  return {
    author,
    isVerified: false,
    bio: profile.bio ?? "",
    stats: {
      following: profile.followingCount,
      followers: profile.followerCount,
      // Summed by video-service over this creator's videos; 0 until that answers, and
      // 0 for good if it fails — a header that renders is worth more than an exact count.
      likes: options.totalLikes ?? 0,
    },
    isFollowing: options.isFollowing ?? false,
    posts: {
      videos,
      reposts: [],
      favorites: [],
      liked: [],
    },
  };
}
