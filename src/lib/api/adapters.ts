import type {
  InteractionCountResponse,
  MeResponse,
  UserProfileResponse,
  VideoResponse,
} from "@/lib/api/types";
import type { Author, ExploreItem, FeedVideo, ProfileVideo, UserProfile } from "@/types/tiktok";

/**
 * Backend DTOs → the UI shapes in `types/tiktok.ts`. Every mismatch between
 * what the services return and what the cloned UI renders is resolved here and
 * nowhere else, so components stay unaware of the wire format.
 *
 * Gaps worth knowing about, because they are backend limitations rather than
 * choices made here:
 *
 *  1. **Not every account has a handle.** user-service copies it off the
 *     registration event, so accounts older than that have none. A profile's
 *     route segment is therefore its numeric id — `/@123456789012345` — which
 *     always resolves; `/@name` still works through `by-username`.
 *  2. **No duration until transcoding lands.** `durationSeconds` is 0 until
 *     the file has been probed. `width`/`height` are real once transcoding
 *     finishes; portrait 1080×1920 is only the fallback before that, or for
 *     videos uploaded before video-service measured them.
 *  3. **No music, and no share or save counts on the video.** interaction-service
 *     counts both, but `VideoResponse` carries neither the way it carries likes
 *     and comments, so a card built without that service's counts
 *     (`getVideoCounts`) shows 0 for them.
 */

/** The route segment for a backend account: its id, since there is no handle. */
export function handleFor(userId: string): string {
  return userId;
}

/** True when a `/@…` segment is a user-service id rather than a handle. */
export function isBackendHandle(handle: string): boolean {
  return /^\d+$/.test(handle);
}

/**
 * True when a video id is shaped like video-service's: a 19-digit Snowflake.
 * Anything else ("1", "x7") cannot be a video, so it 404s without a request.
 * Length matters — any run of digits, as `isBackendHandle` takes it, would let
 * "1" through to the backend — and it is tested as a string: parsing a
 * Snowflake into a JS number loses precision silently.
 */
export function isBackendVideoId(id: string): boolean {
  return /^\d{15,}$/.test(id);
}

/**
 * The "@handle" to show in a header or list row, or null when there isn't a
 * real one to show. `author.handle` is the real handle; `username` is only a
 * usable fallback when it is not the numeric id, which is never what a reader
 * wants to see.
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
  options: { isFollowing?: boolean; counts?: InteractionCountResponse } = {},
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
      // Null when comments are off — `commentsDisabled` is what the UI reads then.
      comments: video.commentCount ?? 0,
      // See the module doc: these two come from interaction-service, or not at all.
      bookmarks: options.counts?.saveCount ?? 0,
      shares: options.counts?.shareCount ?? 0,
    },
    // Empty until transcoding produces the HLS manifest — VideoCard falls back
    // to a poster-only card, which is exactly the PROCESSING state.
    videoUrl: video.hlsUrl ?? "",
    // video-service reports the true, rotation-corrected size once transcoding
    // finishes; portrait is only the fallback for videos it hasn't measured.
    width: video.width ?? 1080,
    height: video.height ?? 1920,
    // Same reason as `videoToProfileVideo`: video-service has no thumbnails
    // yet, and one shared fallback made every card in the feed the same
    // picture. Empty means "no poster" — `VideoCard` handles it.
    posterUrl: video.thumbnailUrl ?? "",
    durationSeconds: video.durationSeconds ?? 0,
    createdAt: video.createdAt,
    isFollowing: options.isFollowing ?? false,
    hasTranslation: false,
    visibility: video.visibility,
    // Either switch closes the video the same way; only the owner's own toggle
    // needs to tell them apart.
    commentsDisabled: video.commentsDisabled || video.accountCommentsOff,
    commentsSwitchOff: video.commentsDisabled,
  };
}

/**
 * No stand-in poster on purpose: `thumbnailUrl` is null until transcoding
 * extracts one, and one shared fallback image made every tile in the grid the
 * same picture. Empty instead, which `ProfileTile` reads as "let the browser
 * draw the first frame".
 */
export function videoToProfileVideo(video: VideoResponse): ProfileVideo {
  return {
    id: video.id,
    posterUrl: video.thumbnailUrl ?? "",
    videoUrl: video.hlsUrl ?? "",
    views: video.viewCount,
    isPrivate: video.visibility === "PRIVATE",
    status: video.status,
  };
}

/**
 * A backend video for the Explore grid. `category` is never video-service's —
 * it has no taxonomy — so it is whatever the caller filtered by: "All" for the
 * plain feed, or the tapped tab's label when the tile came back from a search
 * scoped to it.
 */
export function videoToExploreItem(
  video: VideoResponse,
  author: Author,
  category: string,
): ExploreItem {
  return {
    id: video.id,
    category,
    author,
    caption: video.description || video.title,
    posterUrl: video.thumbnailUrl ?? "",
    videoUrl: video.hlsUrl ?? "",
    views: video.viewCount,
    likes: video.likeCount,
  };
}

/**
 * A profile page from what the backend can actually supply.
 *
 * `isVerified` does not exist as a concept in user-service. `likes` is
 * video-service's aggregate, and reposts/favourites/liked are filled in by
 * `BackendProfilePage` when their tab is opened.
 */
export function profileToUserProfile(
  profile: UserProfileResponse,
  author: Author,
  videos: ProfileVideo[],
  options: { isFollowing?: boolean; followRequested?: boolean; totalLikes?: number } = {},
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
    followRequested: options.followRequested ?? false,
    posts: {
      videos,
      reposts: [],
      favorites: [],
      liked: [],
    },
  };
}
