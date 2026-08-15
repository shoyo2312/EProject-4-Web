/** Content structures observed on the TikTok For You feed. */

export interface Author {
  /**
   * The backend's account id, present only for authors that came from the API
   * (mock authors have none). It is what every user-service and video-service
   * call is keyed by — `username` cannot be used for that, because
   * user-service stores no handle. A Snowflake, kept as a string: see
   * `lib/api/json.ts`.
   */
  userId?: string;
  /** Handle without the leading "@", e.g. "sashtalk". */
  username: string;
  /** Display name shown next to the caption, e.g. "SASH TALK". */
  nickname: string;
  avatarUrl: string;
}

/** One tile in the share sheet's second row. */
export interface ShareTarget {
  id: string;
  /** Verbatim label from the live sheet, e.g. "WhatsApp". */
  label: string;
  /**
   * Brand colour for the 64px disc. Absent for TikTok's own actions (Repost,
   * Copy, Embed, Email), which use the neutral field colour.
   */
  tint?: string;
}

export interface MusicTrack {
  title: string;
  author: string;
  /** Album art shown in the spinning disc at the bottom of the action rail. */
  coverUrl: string;
}

export interface VideoStats {
  likes: number;
  comments: number;
  bookmarks: number;
  shares: number;
}

export interface FeedVideo {
  id: string;
  author: Author;
  /** Verbatim caption text, may contain hashtags. */
  caption: string;
  music: MusicTrack;
  stats: VideoStats;
  /** Local path under /videos. */
  videoUrl: string;
  /**
   * Intrinsic pixel size of the media. The card takes its `aspect-ratio`
   * straight from `width / height` — TikTok does not normalise uploads to 9:16,
   * it sizes the player to whatever was uploaded (observed live: a 1278×720
   * card carrying `aspect-ratio: 1.775 / 1`, i.e. the raw ratio, not 16/9).
   * `width > height` also selects the landscape sizing branch.
   */
  width: number;
  height: number;
  /** Poster frame under /images, shown before the video decodes. */
  posterUrl: string;
  /** Duration in seconds — drives the "00:02 / 01:39" progress label. */
  durationSeconds: number;
  /** Whether the signed-in user already follows this author. */
  isFollowing: boolean;
  /** Whether a "See translation" affordance appears under the caption. */
  hasTranslation: boolean;
}

export interface Comment {
  id: string;
  author: Author;
  text: string;
  /** Relative time as rendered on the live site, e.g. "3d ago". */
  timestamp: string;
  likes: number;
  /** Marks the video's own creator — renders the "Creator" pill. */
  isCreator?: boolean;
  /**
   * Replies to this comment. TikTok nests **exactly one level**: a reply has no
   * `replies` of its own, and replying to a reply still lands in this same flat
   * list. Present only on top-level comments.
   */
  replies?: Comment[];
}

/**
 * One tile in the Explore grid (`.DivItemContainerV2`). It is a poster with a
 * view count overlaid, plus an author row underneath — not a full `FeedVideo`,
 * so it carries only what that card renders.
 */
export interface ExploreItem {
  id: string;
  /** Category label it is filed under; matches one of `EXPLORE_CATEGORIES`. */
  category: string;
  author: Author;
  caption: string;
  posterUrl: string;
  /** Played muted on hover, the way the live grid previews a tile. */
  videoUrl: string;
  views: number;
}

/**
 * One card in the `/following` suggestion grid (`.DivUserCard`). The live page
 * renders this grid — not a video feed — whenever the viewer follows nobody
 * yet: a 226×302 poster from one of the creator's videos, previewing on hover,
 * with the creator's identity and a Follow button laid over its lower half.
 */
export interface SuggestedCreator {
  id: string;
  author: Author;
  /** Renders the 12px `#20D5EC` `.DivVerifiedBadgeContainer` after the handle. */
  isVerified: boolean;
  /** Cover frame filling the card, `object-fit: cover`. */
  posterUrl: string;
  /** Played muted on hover, over the poster — the live card previews once, no loop. */
  videoUrl: string;
  /** Whether the viewer already follows them; drives the button's initial state. */
  isFollowing: boolean;
}

/**
 * The four tabs of a profile page, in the order the live bar renders them.
 * (A fifth, "Short dramas", exists in the live DOM but stays 0×0 unless the
 * account has that content, so it is not modelled.)
 */
export type ProfileTab = "videos" | "reposts" | "favorites" | "liked";

/**
 * One tile in the profile grid (`.DivItemContainerV2`). Deliberately smaller
 * than `ExploreItem`: the profile grid renders **no caption and no author row**
 * under the poster — just the cover with its view count — because the whole
 * grid already belongs to one creator.
 */
export interface ProfileVideo {
  id: string;
  posterUrl: string;
  /** Played muted on hover, the way the live grid previews a tile. */
  videoUrl: string;
  views: number;
}

/** The header of `/@handle` plus the content behind each of its tabs. */
export interface UserProfile {
  author: Author;
  /** Renders the `#20D5EC` tick after the handle. */
  isVerified: boolean;
  /** `[data-e2e="user-bio"]`. Empty accounts show "No bio yet." instead. */
  bio: string;
  /** External link under the bio, e.g. "linktr.ee/tiktok". Most have none. */
  link?: string;
  stats: { following: number; followers: number; likes: number };
  /** Whether the viewer already follows them; the button's initial state. */
  isFollowing: boolean;
  /**
   * Tiles per tab. Each list is in **Latest** order — the sort control derives
   * its other two options from it (Oldest reverses, Popular sorts by views),
   * which is why no timestamp is carried here.
   */
  posts: Record<ProfileTab, ProfileVideo[]>;
}

export interface ActivityNotification {
  id: string;
  /** `.PTitleText` — one line, ellipsised. */
  title: string;
  /** `.PSystemNotifDescText` — one line, ellipsised. */
  description: string;
  /** Renders the 6px red `TUXAlertBadgeDot` in the trailing container. */
  unread?: boolean;
}

export interface ActivityGroup {
  /** `.PTimeGroupTitle`, e.g. "Yesterday". */
  title: string;
  items: ActivityNotification[];
}

export type NavItemKind = "link" | "button";

export interface NavItem {
  label: string;
  kind: NavItemKind;
  /** Present when kind === "link". */
  href?: string;
  /** Unread count rendered as a red dot badge, e.g. Activity. */
  badgeCount?: number;
  /**
   * Rows the live sidebar drops for a signed-out viewer. Measured against the
   * guest sidebar, which lists only For You / Explore / Following / LIVE /
   * Upload / Profile / More.
   */
  authOnly?: boolean;
}

/** One row in an option list — the login modal, `/login` or `/signup`. */
export interface LoginOption {
  /** Verbatim label, e.g. "Continue with Facebook". */
  label: string;
  /**
   * "qr" and "person" are TikTok's own glyphs; "brand" renders a plain disc in
   * `tint` rather than a third-party logo.
   */
  icon: "qr" | "person" | "brand";
  /** Brand colour for the disc, set only when `icon` is "brand". */
  tint?: string;
  /**
   * Set on the two rows auth-service can actually sign in — the row runs the
   * provider's SDK and posts the token to `/auth/oauth/{provider}`. The rows
   * without it (LINE, KakaoTalk, Apple) have no backend behind them and fall
   * back to the email flow.
   */
  provider?: "google" | "facebook";
  /**
   * Draws the cyan "Last login" flag over the row's top-right corner. The live
   * page sets it from the viewer's own history; the clone hard-codes it on the
   * phone/email row so the badge is visible at all.
   */
  lastLogin?: boolean;
}

export interface FooterSection {
  heading: string;
  links: string[];
}

/* --- /setting ------------------------------------------------------------ */

/**
 * Which glyph a settings section shows in the left nav. Kept as a name rather
 * than a component so the section list stays plain data on the server.
 */
export type SettingsIconName =
  | "manage-account"
  | "privacy"
  | "push-notifications"
  | "business-verification"
  | "ads"
  | "screen-time"
  | "content-preferences"
  | "accessibility";

/**
 * The five row shapes the live settings panel uses. `link` and `value` both
 * end in a chevron; `value` also shows the current choice before it. `expand`
 * is a row that opens in place (caret), `external` leaves TikTok.
 */
export type SettingsRow = { title: string; description?: string } & (
  | { kind: "link" }
  | { kind: "value"; value: string }
  | { kind: "switch"; on: boolean }
  | { kind: "expand" }
  | { kind: "external" }
);

export interface SettingsGroup {
  heading?: string;
  /** Text under the heading, e.g. "Your preferences will be synced…". */
  description?: string;
  /**
   * The Ads section renders its headings at 500 weight in `rgba(255,255,255,.6)`
   * and flush with the panel edge, where every other section uses 600 at .9 and
   * indents by 16. It is a second design generation on the same page, not a
   * mistake, so it is carried as a flag.
   */
  muted?: boolean;
  rows: SettingsRow[];
}

export interface SettingsSection {
  /** Anchor id, also the scroll-spy key. */
  id: string;
  label: string;
  icon: SettingsIconName;
  groups: SettingsGroup[];
}
