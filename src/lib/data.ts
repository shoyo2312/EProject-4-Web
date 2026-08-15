import {
  ACTIVITY_FILTERS,
  ACTIVITY_GROUPS,
  CURRENT_SESSION,
  CURRENT_USER,
  EXPLORE_CATEGORIES,
  EXPLORE_ITEMS,
  exploreItemAsVideo,
  FEED_COMMENTS,
  FEED_VIDEOS,
  FOOTER_SECTIONS,
  generatedProfile,
  LOGIN_OPTIONS,
  LOGIN_PAGE_OPTIONS,
  NAV_ITEMS,
  PROFILES,
  profileVideoAsVideo,
  SETTINGS_SECTIONS,
  SIGNUP_OPTIONS,
  SUGGESTED_CREATORS,
} from "@/lib/mock-feed";
import type {
  ActivityGroup,
  Author,
  Comment,
  ExploreItem,
  FeedVideo,
  FooterSection,
  LoginOption,
  NavItem,
  ProfileTab,
  SettingsSection,
  SuggestedCreator,
  UserProfile,
} from "@/types/tiktok";

/**
 * The single place pages read content from. Everything here is async and
 * returns the mock data in `lib/mock-feed.ts`; swapping a body for a `fetch`
 * (or a database call) is then the only change a real backend needs — no page
 * or component has to move.
 *
 * Server components await these and pass the result down as props, so the
 * mock module never ends up in the client bundle.
 */

export async function getFeedVideos(): Promise<FeedVideo[]> {
  return FEED_VIDEOS;
}

/** Comments for the whole feed, keyed by video id. */
export async function getFeedComments(): Promise<Record<string, Comment[]>> {
  return FEED_COMMENTS;
}

/** The signed-in viewer. */
export async function getCurrentUser(): Promise<Author> {
  return CURRENT_USER;
}

/**
 * The viewer this render is for, or `null` for a signed-out visitor. Every
 * signed-out difference in the UI hangs off this one value.
 */
export async function getSessionUser(): Promise<Author | null> {
  return CURRENT_SESSION;
}

/** Rows of the login modal's option list. */
export async function getLoginOptions(): Promise<LoginOption[]> {
  return LOGIN_OPTIONS;
}

/** Rows of `/login`'s option list, which differ from the modal's. */
export async function getLoginPageOptions(): Promise<LoginOption[]> {
  return LOGIN_PAGE_OPTIONS;
}

/** Rows of `/signup`'s option list. */
export async function getSignupOptions(): Promise<LoginOption[]> {
  return SIGNUP_OPTIONS;
}

export async function getExploreCategories(): Promise<readonly string[]> {
  return EXPLORE_CATEGORIES;
}

export async function getExploreItems(): Promise<ExploreItem[]> {
  return EXPLORE_ITEMS;
}

/**
 * One video by id, from any of the three sources — feed ids are plain numbers
 * ("1"), Explore ids are prefixed ("x7") and profile tiles are
 * "handle:tab:index". Returns null so the route can `notFound()`.
 */
export async function getVideoById(id: string): Promise<FeedVideo | null> {
  const feedVideo = FEED_VIDEOS.find((video) => video.id === id);
  if (feedVideo) return feedVideo;

  const exploreItem = EXPLORE_ITEMS.find((item) => item.id === id);
  if (exploreItem) return exploreItemAsVideo(exploreItem);

  // Profile tiles carry their origin in the id ("citylapse~videos~3"), so a
  // permalink resolves without the profile having to be listed anywhere.
  const [username, tab] = id.split("~");
  if (!username || !isProfileTab(tab)) return null;

  const profile = await getProfile(username);
  const post = profile?.posts[tab].find((entry) => entry.id === id);
  return profile && post ? profileVideoAsVideo(profile, post) : null;
}

const PROFILE_TABS: ProfileTab[] = ["videos", "reposts", "favorites", "liked"];

function isProfileTab(value: string | undefined): value is ProfileTab {
  return PROFILE_TABS.includes(value as ProfileTab);
}

/**
 * Comments for one video. Explore videos have no comment list of their own, so
 * they borrow the list of the feed entry sharing their media file — an empty
 * panel would read as a bug rather than as mock data.
 */
export async function getCommentsForVideo(video: FeedVideo): Promise<Comment[]> {
  const own = FEED_COMMENTS[video.id];
  if (own) return own;

  const twin = FEED_VIDEOS.find((entry) => entry.videoUrl === video.videoUrl);
  return (twin && FEED_COMMENTS[twin.id]) ?? [];
}

/**
 * The ids either side of `id`, for the detail page's up/down controls. A video
 * only ever steps within the collection it came from, so an Explore video walks
 * the Explore grid and a feed video walks the feed. `null` at either end.
 */
export async function getVideoNeighbours(
  id: string,
): Promise<{ previousId: string | null; nextId: string | null }> {
  const ids = await collectionIds(id);

  const index = ids.indexOf(id);
  return {
    previousId: index > 0 ? ids[index - 1] : null,
    nextId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
  };
}

/** The ordered ids of whichever collection `id` came from. */
async function collectionIds(id: string): Promise<string[]> {
  if (FEED_VIDEOS.some((video) => video.id === id)) {
    return FEED_VIDEOS.map((video) => video.id);
  }

  const [username, tab] = id.split("~");
  if (username && isProfileTab(tab)) {
    const profile = await getProfile(username);
    return profile?.posts[tab].map((post) => post.id) ?? [];
  }

  return EXPLORE_ITEMS.map((item) => item.id);
}

/**
 * One profile page. `handle` is the raw URL segment, so it still carries its
 * leading "@" — the route passes it through untouched and this is the single
 * place that strips it. Unknown handles get a generated profile rather than a
 * 404, so every `/@author` link in the app leads somewhere.
 */
export async function getProfile(handle: string): Promise<UserProfile | null> {
  const username = decodeURIComponent(handle).replace(/^@/, "");
  if (!username) return null;

  return PROFILES[username] ?? generatedProfile(username);
}

/** The eight sections of `/setting`, in the order the live nav lists them. */
export async function getSettingsSections(): Promise<SettingsSection[]> {
  return SETTINGS_SECTIONS;
}

/** Cards for `/following` — who the live grid offers a viewer to follow. */
export async function getSuggestedCreators(): Promise<SuggestedCreator[]> {
  return SUGGESTED_CREATORS;
}

export async function getNavItems(): Promise<NavItem[]> {
  return NAV_ITEMS;
}

export async function getFooterSections(): Promise<FooterSection[]> {
  return FOOTER_SECTIONS;
}

export async function getActivity(): Promise<{
  filters: readonly string[];
  groups: ActivityGroup[];
}> {
  return { filters: ACTIVITY_FILTERS, groups: ACTIVITY_GROUPS };
}
