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
 *  3. **No music, no bookmark/share counters.** Those belong to services that
 *     are not built yet; they render as neutral placeholders.
 */

/** The route segment for a backend account: its id, since there is no handle. */
export function handleFor(userId: string): string {
  return userId;
}

/** True when a `/@…` segment addresses a backend account rather than mock data. */
export function isBackendHandle(handle: string): boolean {
  return /^\d+$/.test(handle);
}

const FALLBACK_AVATAR = "/images/avatars/avatar-1.jpeg";
const FALLBACK_POSTER = "/images/posters/poster-1.jpg";

export function authorFromProfile(profile: UserProfileResponse): Author {
  return {
    userId: profile.userId,
    username: handleFor(profile.userId),
    nickname: profile.displayName ?? `user${profile.userId}`,
    avatarUrl: profile.avatarUrl ?? FALLBACK_AVATAR,
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
    nickname: me.displayName ?? me.username,
    avatarUrl: me.avatarUrl ?? FALLBACK_AVATAR,
  };
}

/** Stand-in for an author whose profile could not be read (guest, or blocked). */
export function unknownAuthor(userId: string): Author {
  return {
    userId,
    username: handleFor(userId),
    nickname: `user${userId}`,
    avatarUrl: FALLBACK_AVATAR,
  };
}

export function videoToFeedVideo(
  video: VideoResponse,
  author: Author,
  options: { isFollowing?: boolean } = {},
): FeedVideo {
  const caption = video.description
    ? `${video.title} ${video.description}`
    : video.title;

  return {
    id: video.id,
    author,
    caption,
    music: {
      title: `original sound - ${author.nickname}`,
      author: author.nickname,
      coverUrl: author.avatarUrl,
    },
    stats: {
      likes: video.likeCount,
      comments: video.commentCount,
      // interaction-service is not wired up yet; these have no source.
      bookmarks: 0,
      shares: 0,
    },
    // Empty until transcoding produces the HLS manifest — VideoCard falls back
    // to a poster-only card, which is exactly the PROCESSING state.
    videoUrl: video.hlsUrl ?? "",
    width: 1080,
    height: 1920,
    posterUrl: video.thumbnailUrl ?? FALLBACK_POSTER,
    durationSeconds: video.durationSeconds ?? 0,
    isFollowing: options.isFollowing ?? false,
    hasTranslation: false,
  };
}

export function videoToProfileVideo(video: VideoResponse): ProfileVideo {
  return {
    id: video.id,
    posterUrl: video.thumbnailUrl ?? FALLBACK_POSTER,
    videoUrl: video.hlsUrl ?? "",
    views: video.viewCount,
  };
}

/**
 * A profile page from what the backend can actually supply.
 *
 * `likes` has no source (interaction-service), `isVerified` does not exist as a
 * concept in user-service, and only the "videos" tab has data — reposts,
 * favourites and liked are all other services' territory, so they render empty
 * rather than borrowing mock content that would be a lie.
 */
export function profileToUserProfile(
  profile: UserProfileResponse,
  author: Author,
  videos: ProfileVideo[],
  options: { isFollowing?: boolean } = {},
): UserProfile {
  return {
    author,
    isVerified: false,
    bio: profile.bio ?? "",
    stats: {
      following: profile.followingCount,
      followers: profile.followerCount,
      likes: 0,
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
