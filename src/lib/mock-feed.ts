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
  ProfileVideo,
  SettingsSection,
  ShareTarget,
  SuggestedCreator,
  UserProfile,
} from "@/types/tiktok";

/**
 * The signed-in viewer. Same avatar the TopBar renders, reused as the author of
 * any comment or reply posted from the composer.
 */
export const CURRENT_USER: Author = {
  // The handle the sidebar's Profile row already points at (`/@user`), so the
  // viewer's own profile page and every "you" byline resolve to one identity.
  username: "user",
  nickname: "you",
  avatarUrl: "/images/avatars/avatar-1.jpeg",
};

/**
 * Who the app renders for. Set to `null` to serve every page in the signed-out
 * state the live site shows a logged-out visitor — a seven-row sidebar with a
 * Log in button, a Log in pill in place of the avatar, and the login modal in
 * front of any action that needs an account.
 *
 * `?guest=1` on any URL forces that state without editing this line.
 */
export const CURRENT_SESSION: Author | null = CURRENT_USER;

/**
 * The login modal's option list, verbatim and in order from the live modal.
 * The four third-party rows carry their brand colour only; see `LoginModal`
 * for why their logos are not vendored.
 */
export const LOGIN_OPTIONS: LoginOption[] = [
  // { label: "Use QR code", icon: "qr" },
  { label: "Use email or username", icon: "person" },
  { label: "Continue with Facebook", icon: "brand", tint: "#1877F2", provider: "facebook" },
  { label: "Continue with Google", icon: "brand", tint: "#FFFFFF", provider: "google" },
  // { label: "Continue with LINE", icon: "brand", tint: "#06C755" },
  // { label: "Continue with KakaoTalk", icon: "brand", tint: "#FEE500" },
  // { label: "Continue with Apple", icon: "brand", tint: "#FFFFFF" },
];

/**
 * `/login`'s option list. Same seven rows as the modal, but the page words the
 * email row differently ("Use email / username") and flags the row the viewer
 * last used — so it is a separate list, not a reference to the modal's.
 */
export const LOGIN_PAGE_OPTIONS: LoginOption[] = [
  // { label: "Use QR code", icon: "qr" },
  { label: "Use email / username", icon: "person", lastLogin: true },
  { label: "Continue with Facebook", icon: "brand", tint: "#1877F2", provider: "facebook" },
  { label: "Continue with Google", icon: "brand", tint: "#FFFFFF", provider: "google" },
  // { label: "Continue with LINE", icon: "brand", tint: "#06C755" },
  // { label: "Continue with KakaoTalk", icon: "brand", tint: "#FEE500" },
  // { label: "Continue with Apple", icon: "brand", tint: "#FFFFFF" },
];

/**
 * `/signup`'s option list, verbatim from the live page. It is not the login
 * list minus a row: there is no QR option, the email row is worded
 * differently, and no row carries a "Last login" flag.
 */
export const SIGNUP_OPTIONS: LoginOption[] = [
  { label: "Use email", icon: "person" },
  { label: "Continue with Facebook", icon: "brand", tint: "#1877F2", provider: "facebook" },
  { label: "Continue with Google", icon: "brand", tint: "#FFFFFF", provider: "google" },
  // { label: "Continue with LINE", icon: "brand", tint: "#06C755" },
  // { label: "Continue with KakaoTalk", icon: "brand", tint: "#FEE500" },
  // { label: "Continue with Apple", icon: "brand", tint: "#FFFFFF" },
];

/**
 * Sidebar navigation — order, labels, hrefs and the Activity badge are taken
 * verbatim from the live site's `.DivMainNavContainer` (10 children, in order).
 * "Messages", "Activity" and "More" render as buttons, not links.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "For You", kind: "link", href: "/" },
  { label: "Explore", kind: "link", href: "/explore" },
  { label: "Following", kind: "link", href: "/following" },
  { label: "Friends", kind: "link", href: "/friends", authOnly: true },
  { label: "LIVE", kind: "link", href: "/live" },
  { label: "Messages", kind: "button", authOnly: true },
  // The badge count on the live site was the account owner's real unread count.
  // It is deliberately replaced with an arbitrary number — it is personal data,
  // not a design token.
  { label: "Activity", kind: "button", badgeCount: 3, authOnly: true },
  { label: "Upload", kind: "link", href: "/nowastudio/upload" },
  { label: "Profile", kind: "link", href: "/@user" },
  { label: "More", kind: "button" },
];

/**
 * Sidebar footer. Headings **and** link lists are now verbatim from the live
 * `.DivFooterContainer` — an earlier pass shipped invented filler links.
 *
 * The lists only exist in the DOM while their section is expanded: the footer
 * is a single-open accordion that starts fully collapsed, so all three had to
 * be opened in turn to read them.
 */
export const FOOTER_SECTIONS: FooterSection[] = [
  {
    heading: "Company",
    links: ["About", "Newsroom", "Contact", "Careers"],
  },
  {
    heading: "Program",
    links: [
      "Nowa for Good",
      "Advertise",
      "Sell on Nowa Shop",
      "Nowa LIVE Creator Networks",
      "Developers",
      "Transparency",
      "Nowa Embeds",
      "SoundOn Music Distribution",
      "Nowa Live",
      "Nowa Shop",
    ],
  },
  {
    heading: "Terms & Policies",
    links: [
      "Help",
      "Safety",
      "Terms",
      "Privacy Policy",
      "Accessibility",
      "Privacy Center",
      "Creator Academy",
      "Community Guidelines",
      "Copyright",
      "Law Enforcement Guidelines",
    ],
  },
];

/**
 * Feed content.
 *
 * The captions/handles here are invented rather than copied from the live
 * personalised feed. The media are files the repo owner supplied — still no
 * TikTok-sourced video, avatar or album art is vendored here; see
 * docs/research/tiktok.com/ASSETS.md.
 *
 * `durationSeconds` mirrors each file's real length (read with `mdls`) so the
 * progress bar is right on first paint, before `loadedmetadata` fires.
 */
export const FEED_VIDEOS: FeedVideo[] = [
  {
    id: "1",
    author: {
      username: "citylapse",
      nickname: "City Lapse",
      avatarUrl: "/images/avatars/avatar-1.jpeg",
    },
    caption: "golden hour from the 40th floor 🌇 #timelapse #cityscape",
    music: {
      title: "Skyline Drift",
      author: "Nova Kane",
      coverUrl: "/images/avatars/avatar-1.jpeg",
    },
    stats: { likes: 355800, comments: 6834, bookmarks: 20100, shares: 38400 },
    videoUrl: "/videos/video-1.mp4",
    posterUrl: "/images/posters/poster-1.jpg",
    // Landscape — exercises the second of TikTok's two card branches.
    width: 1024,
    height: 576,
    durationSeconds: 38.9,
    isFollowing: false,
    hasTranslation: true,
  },
  {
    id: "2",
    author: {
      username: "doughlab",
      nickname: "Dough Lab",
      avatarUrl: "/images/avatars/avatar-2.jpeg",
    },
    caption: "72-hour cold ferment. worth every minute 🍕 #baking #pizza",
    music: {
      title: "Kitchen Sessions",
      author: "Marlo",
      coverUrl: "/images/avatars/avatar-2.jpeg",
    },
    stats: { likes: 128400, comments: 2190, bookmarks: 44700, shares: 9120 },
    videoUrl: "/videos/video-2.mp4",
    posterUrl: "/images/posters/poster-2.jpg",
    width: 576,
    height: 1024,
    durationSeconds: 7.17,
    isFollowing: true,
    hasTranslation: false,
  },
  {
    id: "3",
    author: {
      username: "trailrunner",
      nickname: "Trail Runner",
      avatarUrl: "/images/avatars/avatar-3.jpeg",
    },
    caption: "28km, 1400m elevation, zero regrets ⛰️ #running #trail",
    music: {
      title: "Uphill",
      author: "Field Notes",
      coverUrl: "/images/avatars/avatar-3.jpeg",
    },
    stats: { likes: 892000, comments: 15200, bookmarks: 77300, shares: 61500 },
    videoUrl: "/videos/video-3.mp4",
    posterUrl: "/images/posters/poster-3.jpg",
    width: 576,
    height: 1024,
    durationSeconds: 12.02,
    isFollowing: false,
    hasTranslation: false,
  },
];

/**
 * Comment threads, keyed by video id.
 *
 * The text is written for this clone, not scraped: real comments are third
 * parties' content pulled from an authenticated session, and vendoring them
 * would carry personal data into the repo. Only the *shape* is copied from the
 * live site — creator pill, timestamp, "Reply", like count.
 *
 * Threads are **one level deep**, which is also TikTok's own limit: replying to
 * a reply appends to the same flat list rather than nesting further. Timestamps
 * follow TikTok's two formats — relative ("3d ago") for recent, "M-D" ("6-30")
 * for older.
 */
export const FEED_COMMENTS: Record<string, Comment[]> = {
  "1": [
    {
      id: "c1-1",
      author: {
        username: "nightowl.jpg",
        nickname: "nightowl.jpg",
        avatarUrl: "/images/avatars/avatar-2.jpeg",
      },
      text: "the way the lights come on one by one is unreal",
      timestamp: "3d ago",
      likes: 1284,
      replies: [
        {
          id: "c1-1-r1",
          author: {
            username: "citylapse",
            nickname: "City Lapse",
            avatarUrl: "/images/avatars/avatar-1.jpeg",
          },
          text: "that's the part I waited two hours for 😅",
          timestamp: "3d ago",
          likes: 210,
          isCreator: true,
        },
        {
          id: "c1-1-r2",
          author: {
            username: "nightowl.jpg",
            nickname: "nightowl.jpg",
            avatarUrl: "/images/avatars/avatar-2.jpeg",
          },
          text: "worth it",
          timestamp: "3d ago",
          likes: 44,
        },
      ],
    },
    {
      id: "c1-2",
      author: {
        username: "citylapse",
        nickname: "City Lapse",
        avatarUrl: "/images/avatars/avatar-1.jpeg",
      },
      text: "shot over 4 hours, 1 frame every 6 seconds 🙏",
      timestamp: "3d ago",
      likes: 902,
      isCreator: true,
    },
    {
      id: "c1-3",
      author: {
        username: "marabuilds",
        nickname: "marabuilds",
        avatarUrl: "/images/avatars/avatar-3.jpeg",
      },
      text: "which floor is this? need it for my next shoot",
      timestamp: "2d ago",
      likes: 341,
      replies: [
        {
          id: "c1-3-r1",
          author: {
            username: "citylapse",
            nickname: "City Lapse",
            avatarUrl: "/images/avatars/avatar-1.jpeg",
          },
          text: "40th, east side stairwell — it's open till 8",
          timestamp: "2d ago",
          likes: 128,
          isCreator: true,
        },
      ],
    },
    {
      id: "c1-4",
      author: {
        username: "tempoflux",
        nickname: "tempoflux",
        avatarUrl: "/images/avatars/avatar-2.jpeg",
      },
      text: "sound design carries this one honestly",
      timestamp: "1d ago",
      likes: 88,
    },
  ],
  "2": [
    {
      id: "c2-1",
      author: {
        username: "flourandsalt",
        nickname: "flourandsalt",
        avatarUrl: "/images/avatars/avatar-3.jpeg",
      },
      text: "72 hours is wild but the crumb speaks for itself",
      timestamp: "5d ago",
      likes: 2140,
    },
    {
      id: "c2-2",
      author: {
        username: "doughlab",
        nickname: "Dough Lab",
        avatarUrl: "/images/avatars/avatar-2.jpeg",
      },
      text: "cold ferment does the work so you don't have to",
      timestamp: "5d ago",
      likes: 1533,
      isCreator: true,
    },
    {
      id: "c2-3",
      author: {
        username: "okaykev",
        nickname: "okaykev",
        avatarUrl: "/images/avatars/avatar-1.jpeg",
      },
      text: "tried this at 48h and it was already so much better",
      timestamp: "4d ago",
      likes: 407,
    },
  ],
  "3": [
    {
      id: "c3-1",
      author: {
        username: "quietmiles",
        nickname: "quietmiles",
        avatarUrl: "/images/avatars/avatar-1.jpeg",
      },
      text: "saving this for the next long drive",
      timestamp: "6-30",
      likes: 623,
    },
    {
      id: "c3-2",
      author: {
        username: "hbrooks",
        nickname: "hbrooks",
        avatarUrl: "/images/avatars/avatar-3.jpeg",
      },
      text: "no notes. none.",
      timestamp: "6d ago",
      likes: 199,
    },
  ],
};

/**
 * Activity drawer filter chips — verbatim labels and order from the live
 * `.DivGroupContainer`. These are UI chrome, not user content.
 */
export const ACTIVITY_FILTERS = [
  "All activity",
  "Likes",
  "Comments",
  "Mentions and tags",
  "Followers",
] as const;

/**
 * Notification groups. The group heading style ("Yesterday") is verbatim; the
 * notifications themselves are written for this clone. The live drawer showed
 * the account owner's real notifications — personal data that must not be
 * vendored, same reasoning as `FEED_COMMENTS`.
 */
export const ACTIVITY_GROUPS: ActivityGroup[] = [
  {
    title: "Yesterday",
    items: [
      {
        id: "n1",
        title: "Your video is doing well",
        description: "golden hour from the 40th floor passed 300K views",
        unread: true,
      },
      {
        id: "n2",
        title: "nightowl.jpg commented",
        description: "the way the lights come on one by one is unreal",
        unread: true,
      },
      {
        id: "n3",
        title: "New follower",
        description: "marabuilds started following you",
        unread: true,
      },
    ],
  },
  {
    title: "This week",
    items: [
      {
        id: "n4",
        title: "tempoflux mentioned you",
        description: "tagged you in a comment",
      },
      {
        id: "n5",
        title: "Weekly summary",
        description: "Your videos reached 1.2M people this week",
      },
      {
        id: "n6",
        title: "okaykev liked your video",
        description: "72-hour cold ferment. worth every minute",
      },
    ],
  },
];

/**
 * Share sheet, first row (`.DivActionContainer` × N inside a horizontal
 * scroller).
 *
 * On the live site this row is the signed-in account's **real contact list** —
 * the sheet opened with one entry, a person's name and avatar. That is the
 * account owner's personal data and third parties' identities, so none of it is
 * reproduced. These three are invented; only the row's existence and geometry
 * are taken from the live sheet.
 */
export const SHARE_FRIENDS: Author[] = [
  {
    username: "nightowl.jpg",
    nickname: "nightowl",
    avatarUrl: "/images/avatars/avatar-2.jpeg",
  },
  {
    username: "marabuilds",
    nickname: "marabuilds",
    avatarUrl: "/images/avatars/avatar-3.jpeg",
  },
  {
    username: "tempoflux",
    nickname: "tempoflux",
    avatarUrl: "/images/avatars/avatar-1.jpeg",
  },
];

/**
 * Share sheet, second row. Labels and **order** are verbatim from the live
 * sheet (11 tiles, horizontally scrollable inside a 480px dialog).
 *
 * The live tiles carry each service's real logo. Those are third-party
 * trademarks and are not TikTok's assets either, so the clone does not
 * reproduce them — see `ShareSheet` for what is drawn instead.
 */
export const SHARE_TARGETS: ShareTarget[] = [
  { id: "repost", label: "Repost" },
  { id: "copy", label: "Copy" },
  { id: "whatsapp", label: "WhatsApp", tint: "#25d366" },
  { id: "embed", label: "Embed" },
  { id: "facebook", label: "Facebook", tint: "#1877f2" },
  { id: "telegram", label: "Telegram", tint: "#29a9eb" },
  { id: "x", label: "X", tint: "#000000" },
  { id: "linkedin", label: "LinkedIn", tint: "#0a66c2" },
  { id: "email", label: "Email" },
  { id: "reddit", label: "Reddit", tint: "#ff4500" },
  { id: "line", label: "Line", tint: "#06c755" },
];

/**
 * Explore category rail — the 21 chips of `.DivCategoryList`, in the live
 * site's own order. "All" is the default selection.
 */
export const EXPLORE_CATEGORIES = [
  "All",
  "Singing & Dancing",
  "Comedy",
  "Sports",
  "Anime & Comics",
  "Relationship",
  "Shows",
  "Lipsync",
  "Daily Life",
  "Beauty Care",
  "Games",
  "Society",
  "Outfit",
  "Cars",
  "Food",
  "Animals",
  "Family",
  "Drama",
  "Fitness & Health",
  "Education",
  "Technology",
] as const;

const EXPLORE_AUTHORS: Author[] = [
  {
    username: "citylapse",
    nickname: "City Lapse",
    avatarUrl: "/images/avatars/avatar-1.jpeg",
  },
  {
    username: "doughlab",
    nickname: "Dough Lab",
    avatarUrl: "/images/avatars/avatar-2.jpeg",
  },
  {
    username: "trailrunner",
    nickname: "Trail Runner",
    avatarUrl: "/images/avatars/avatar-3.jpeg",
  },
];

/**
 * Explore grid content.
 *
 * The live grid is a personalised, signed-in recommendation feed of third
 * parties' videos, so none of it is vendored — same rule as the For You mock.
 * These captions are written for the clone and the media are the three local
 * files, cycled. Only the card's *shape* (poster, view count, author row) and
 * the category taxonomy come from the live site.
 */
export const EXPLORE_ITEMS: ExploreItem[] = [
  ["Food", "72-hour cold ferment, cut open 🍕", 2_800_000],
  ["Animals", "he found the one warm tile in the house", 319_000],
  ["Sports", "last 400m of a 28km climb ⛰️", 815_400],
  ["Daily Life", "golden hour from the 40th floor 🌇", 1_200_000],
  ["Food", "sourdough scoring, slow motion", 447_000],
  ["Fitness & Health", "week 6 of the base build", 96_300],
  ["Technology", "timelapse rig, full build breakdown", 2_100_000],
  ["Comedy", "my dough proofing vs my sleep schedule", 5_400_000],
  ["Society", "the city at 5am hits different", 733_000],
  ["Education", "why cold ferment changes the crumb", 188_500],
  ["Animals", "trail dog does not do rest days", 1_900_000],
  ["Outfit", "kit check before a 6-hour run", 61_800],
  ["Cars", "traffic light trails, 4 hours in 12 seconds", 984_000],
  ["Beauty Care", "post-run recovery routine, honestly", 42_100],
  ["Games", "speedrunning the pizza order", 1_450_000],
  ["Drama", "the oven timer betrayed me", 268_000],
  ["Family", "sunday bake with the whole house", 512_000],
  ["Shows", "behind the scenes of the rooftop shoot", 129_700],
].map(([category, caption, views], index) => ({
  id: `x${index + 1}`,
  category: category as string,
  caption: caption as string,
  views: views as number,
  author: EXPLORE_AUTHORS[index % EXPLORE_AUTHORS.length],
  posterUrl: `/images/posters/poster-${(index % 3) + 1}.jpg`,
  videoUrl: `/videos/video-${(index % 3) + 1}.mp4`,
}));

/**
 * An Explore tile as the video page needs it.
 *
 * A tile only carries what the grid renders, but `/video/[id]` reuses the feed's
 * `VideoCard`/`ActionRail`, which need the full `FeedVideo`. The tiles cycle the
 * same three media files as `FEED_VIDEOS`, so the intrinsic size, duration and
 * track are borrowed from whichever feed entry ships that same file — anything
 * else would put the wrong aspect ratio and progress length on the player.
 */
export function exploreItemAsVideo(item: ExploreItem): FeedVideo {
  const source =
    FEED_VIDEOS.find((video) => video.videoUrl === item.videoUrl) ??
    FEED_VIDEOS[0];

  return {
    id: item.id,
    author: item.author,
    caption: item.caption,
    music: source.music,
    // Engagement is derived from the one number a tile does carry, at ratios in
    // the range the feed entries sit at, so the rail is not full of zeroes.
    stats: {
      likes: Math.round(item.views * 0.12),
      comments: Math.round(item.views * 0.004),
      bookmarks: Math.round(item.views * 0.02),
      shares: Math.round(item.views * 0.01),
    },
    videoUrl: item.videoUrl,
    posterUrl: item.posterUrl,
    width: source.width,
    height: source.height,
    durationSeconds: source.durationSeconds,
    isFollowing: false,
    hasTranslation: false,
  };
}

/**
 * The 20 cards the live `/following` grid renders for a viewer who follows
 * nobody. The live grid is filled with real TikTok accounts; those are real
 * people's names, handles and faces pulled from an authenticated session, so —
 * as with `FEED_COMMENTS` — only the *shape* is copied here (20 cards, mixed
 * verified state, handle under a display name) and the identities are invented,
 * reusing the same three creators the rest of the mock data is built from.
 *
 * The live page also appends another 20 on scroll; the clone renders one page.
 */
export const SUGGESTED_CREATORS: SuggestedCreator[] = [
  ["City Lapse", "citylapse", true],
  ["Dough Lab", "doughlab", true],
  ["Trail Runner", "trailrunner", true],
  ["Nightshift Kitchen", "nightshiftkitchen", false],
  ["Rooftop Hours", "rooftophours", true],
  ["Slow Proof", "slowproof", false],
  ["Ridgeline", "ridgeline.runs", true],
  ["Concrete Garden", "concretegarden", false],
  ["The Crumb Report", "crumbreport", true],
  ["Blue Hour Co.", "bluehourco", false],
  ["Kilometre Club", "kilometreclub", true],
  ["Sourdough Sunday", "sourdoughsunday", false],
  ["Skyline Drift", "skylinedrift", true],
  ["Base Build", "basebuild", false],
  ["Ferment & Co.", "fermentandco", true],
  ["Long Exposure", "longexposure", false],
  ["Elevation Gain", "elevationgain", true],
  ["Oven Timer", "oventimer", false],
  ["Traffic Trails", "traffictrails", true],
  ["Rest Day Never", "restdaynever", false],
].map(([nickname, username, isVerified], index) => ({
  id: `s${index + 1}`,
  author: {
    username: username as string,
    nickname: nickname as string,
    avatarUrl: `/images/avatars/avatar-${(index % 3) + 1}.jpeg`,
  },
  isVerified: isVerified as boolean,
  posterUrl: `/images/posters/poster-${(index % 3) + 1}.jpg`,
  videoUrl: `/videos/video-${(index % 3) + 1}.mp4`,
  isFollowing: false,
}));

/**
 * Deterministic 0.28×–4× spread around a creator's typical view count.
 *
 * A real profile grid is not a ramp: it has a couple of breakouts, a body of
 * ordinary posts and a long tail. Multiplying one "typical" number by this
 * table reproduces that shape, and stepping through it by 5 (coprime with 12)
 * visits every entry in a non-monotonic order, so neighbouring tiles never
 * read as a sequence.
 */
const VIEW_SPREAD = [
  0.28, 0.41, 0.55, 0.7, 0.86, 1, 1.2, 1.5, 1.9, 2.4, 3.1, 4,
];

/**
 * Tiles for one tab. The id carries the handle and the tab
 * (`citylapse~videos~3`) so `getVideoById` can resolve a tile back to its
 * profile without an index — the same trick the Explore ids use, one level
 * deeper. The separator is "~" because it is one of the few characters
 * `encodeURIComponent` leaves alone: a ":" here arrives at the page still
 * percent-encoded on a hard load but decoded in `generateMetadata`, and the
 * two disagreeing is a 404.
 */
const profileVideos = (
  username: string,
  tab: ProfileTab,
  seed: number,
  count: number,
  typicalViews: number,
): ProfileVideo[] =>
  Array.from({ length: count }, (_, index) => {
    const n = ((seed + index) % 3) + 1;
    const factor = VIEW_SPREAD[(seed * 7 + index * 5) % VIEW_SPREAD.length];
    return {
      id: `${username}~${tab}~${index + 1}`,
      posterUrl: `/images/posters/poster-${n}.jpg`,
      videoUrl: `/videos/video-${n}.mp4`,
      // Rounded to the nearest hundred, and deterministic, so the server and
      // the client render the same grid.
      views: Math.round((typicalViews * factor) / 100) * 100,
    };
  });

/**
 * Every tab of one profile. `typicalViews` is the creator's own reach and so
 * only drives the Videos tab — the other three hold *other people's* videos,
 * whose numbers have nothing to do with this account's audience and are
 * therefore scaled off fixed, feed-sized figures.
 */
const profilePosts = (
  username: string,
  seed: number,
  typicalViews: number,
  counts: Record<ProfileTab, number>,
): Record<ProfileTab, ProfileVideo[]> => ({
  videos: profileVideos(username, "videos", seed, counts.videos, typicalViews),
  reposts: profileVideos(
    username,
    "reposts",
    seed + 1,
    counts.reposts,
    1_400_000,
  ),
  favorites: profileVideos(
    username,
    "favorites",
    seed + 2,
    counts.favorites,
    780_000,
  ),
  liked: profileVideos(username, "liked", seed + 3, counts.liked, 2_100_000),
});

/**
 * Profile pages, keyed by handle (no leading "@").
 *
 * Same rule as the feed and Explore mocks: nothing here is vendored from a real
 * account. The *shape* is the live one — bio, optional link, three stat groups,
 * four tabs, a caption-less grid — but the identities, numbers and copy are
 * written for the clone, and the media are the three local files cycled.
 *
 * Everyone who appears as a comment author, feed author or share target has an
 * entry, so tapping a handle anywhere in the app opens a profile with a bio and
 * a real follower count rather than the thin generated fallback below.
 *
 * The three stat groups are set by hand rather than summed from `posts`: the
 * grid holds one page of a creator's catalogue, not all of it, so totals
 * derived from it would read far too small next to the follower count.
 */
export const PROFILES: Record<string, UserProfile> = {
  /**
   * The viewer's own profile. Deliberately the smallest account here — a real
   * personal account next to the creators it follows — and the only one whose
   * Favorites and Liked tabs are empty, which is what keeps the owner-view
   * empty state reachable now that the Videos tab has content.
   */
  [CURRENT_USER.username]: {
    author: CURRENT_USER,
    isVerified: false,
    bio: "posting the good ones. mostly food and long drives 🚗",
    stats: { following: 128, followers: 3_204, likes: 41_200 },
    isFollowing: false,
    posts: profilePosts(CURRENT_USER.username, 5, 8_400, {
      videos: 12,
      reposts: 4,
      favorites: 0,
      liked: 0,
    }),
  },
  citylapse: {
    author: {
      username: "citylapse",
      nickname: "City Lapse",
      avatarUrl: "/images/avatars/avatar-1.jpeg",
    },
    isVerified: true,
    bio: "Long exposures from wherever the roof access is unlocked 🌇",
    link: "citylapse.example/prints",
    stats: { following: 182, followers: 2_400_000, likes: 41_800_000 },
    isFollowing: false,
    posts: profilePosts("citylapse", 1, 1_900_000, {
      videos: 18,
      reposts: 6,
      favorites: 9,
      liked: 12,
    }),
  },
  doughlab: {
    author: {
      username: "doughlab",
      nickname: "Dough Lab",
      avatarUrl: "/images/avatars/avatar-2.jpeg",
    },
    isVerified: true,
    bio: "72-hour ferments, one oven, no shortcuts 🍕",
    link: "doughlab.example/recipes",
    stats: { following: 96, followers: 883_400, likes: 12_600_000 },
    isFollowing: true,
    posts: profilePosts("doughlab", 2, 640_000, {
      videos: 14,
      reposts: 0,
      favorites: 5,
      liked: 8,
    }),
  },
  trailrunner: {
    author: {
      username: "trailrunner",
      nickname: "Trail Runner",
      avatarUrl: "/images/avatars/avatar-3.jpeg",
    },
    isVerified: false,
    bio: "Base building in public. Week 6 of 20 ⛰️",
    stats: { following: 341, followers: 156_200, likes: 2_100_000 },
    isFollowing: false,
    posts: profilePosts("trailrunner", 3, 180_000, {
      videos: 11,
      reposts: 3,
      favorites: 0,
      liked: 7,
    }),
  },
  "nightowl.jpg": {
    author: {
      username: "nightowl.jpg",
      nickname: "nightowl.jpg",
      avatarUrl: "/images/avatars/avatar-2.jpeg",
    },
    isVerified: false,
    bio: "everything after midnight",
    stats: { following: 612, followers: 24_800, likes: 391_000 },
    isFollowing: false,
    posts: profilePosts("nightowl.jpg", 4, 31_000, {
      videos: 8,
      reposts: 2,
      favorites: 4,
      liked: 6,
    }),
  },
  marabuilds: {
    author: {
      username: "marabuilds",
      nickname: "marabuilds",
      avatarUrl: "/images/avatars/avatar-3.jpeg",
    },
    isVerified: false,
    bio: "workshop diaries. sawdust in everything 🪚",
    link: "marabuilds.example",
    stats: { following: 208, followers: 71_500, likes: 1_240_000 },
    isFollowing: true,
    posts: profilePosts("marabuilds", 6, 88_000, {
      videos: 15,
      reposts: 0,
      favorites: 7,
      liked: 9,
    }),
  },
  tempoflux: {
    author: {
      username: "tempoflux",
      nickname: "tempoflux",
      avatarUrl: "/images/avatars/avatar-2.jpeg",
    },
    isVerified: true,
    bio: "loops, takes, mistakes 🎧",
    stats: { following: 74, followers: 1_180_000, likes: 19_400_000 },
    isFollowing: false,
    posts: profilePosts("tempoflux", 7, 910_000, {
      videos: 16,
      reposts: 5,
      favorites: 0,
      liked: 11,
    }),
  },
  flourandsalt: {
    author: {
      username: "flourandsalt",
      nickname: "flourandsalt",
      avatarUrl: "/images/avatars/avatar-3.jpeg",
    },
    isVerified: false,
    bio: "two ingredients, endless arguments",
    stats: { following: 430, followers: 38_900, likes: 604_000 },
    isFollowing: false,
    posts: profilePosts("flourandsalt", 8, 46_000, {
      videos: 9,
      reposts: 3,
      favorites: 6,
      liked: 0,
    }),
  },
  okaykev: {
    author: {
      username: "okaykev",
      nickname: "okaykev",
      avatarUrl: "/images/avatars/avatar-1.jpeg",
    },
    isVerified: false,
    bio: "",
    stats: { following: 1_204, followers: 8_610, likes: 96_400 },
    isFollowing: false,
    posts: profilePosts("okaykev", 9, 11_500, {
      videos: 6,
      reposts: 0,
      favorites: 0,
      liked: 5,
    }),
  },
  quietmiles: {
    author: {
      username: "quietmiles",
      nickname: "quietmiles",
      avatarUrl: "/images/avatars/avatar-1.jpeg",
    },
    isVerified: false,
    bio: "long drives, no talking 🚗",
    stats: { following: 89, followers: 112_700, likes: 3_480_000 },
    isFollowing: true,
    posts: profilePosts("quietmiles", 10, 143_000, {
      videos: 13,
      reposts: 4,
      favorites: 8,
      liked: 10,
    }),
  },
  hbrooks: {
    author: {
      username: "hbrooks",
      nickname: "hbrooks",
      avatarUrl: "/images/avatars/avatar-3.jpeg",
    },
    isVerified: false,
    bio: "no notes.",
    stats: { following: 297, followers: 5_140, likes: 62_800 },
    isFollowing: false,
    posts: profilePosts("hbrooks", 11, 6_900, {
      videos: 7,
      reposts: 2,
      favorites: 0,
      liked: 3,
    }),
  },
};

/**
 * A profile for a handle with no entry above — every creator the feed, Explore
 * grid and suggestion cards link to. Their identity comes from wherever they
 * are already mocked, so the page opens with the same avatar the link showed.
 */
export function generatedProfile(username: string): UserProfile {
  const known =
    FEED_VIDEOS.map((video) => video.author).find(
      (author) => author.username === username,
    ) ??
    EXPLORE_ITEMS.map((item) => item.author).find(
      (author) => author.username === username,
    ) ??
    SUGGESTED_CREATORS.map((creator) => creator.author).find(
      (author) => author.username === username,
    );

  const seed = username.length;

  return {
    author: known ?? {
      username,
      nickname: username,
      avatarUrl: `/images/avatars/avatar-${(seed % 3) + 1}.jpeg`,
    },
    isVerified: false,
    bio: "",
    stats: {
      following: 40 + seed * 7,
      followers: 1_200 + seed * 3_400,
      likes: 18_000 + seed * 24_000,
    },
    isFollowing: false,
    posts: profilePosts(username, seed, 64_000, {
      videos: 9,
      reposts: 0,
      favorites: 0,
      liked: 0,
    }),
  };
}

/**
 * A profile tile as a full `FeedVideo`, so `/video/[id]` opens from the profile
 * grid the way it opens from the Explore grid. The caption and music are the
 * card's own — a profile tile carries neither — so they are synthesised from
 * the creator, which is what the live permalink shows anyway.
 */
export function profileVideoAsVideo(
  profile: UserProfile,
  post: ProfileVideo,
): FeedVideo {
  return {
    id: post.id,
    author: profile.author,
    caption: `Posted by ${profile.author.nickname}`,
    music: {
      title: "original sound",
      author: profile.author.nickname,
      coverUrl: profile.author.avatarUrl,
    },
    stats: {
      likes: Math.round(post.views * 0.09),
      comments: Math.round(post.views * 0.004),
      bookmarks: Math.round(post.views * 0.011),
      shares: Math.round(post.views * 0.006),
    },
    videoUrl: post.videoUrl,
    posterUrl: post.posterUrl,
    width: 576,
    height: 1024,
    durationSeconds: 7.17,
    isFollowing: profile.isFollowing,
    hasTranslation: false,
  };
}

/* --- /setting ------------------------------------------------------------ */

/**
 * The settings page, section for section, in the live order and with the live
 * copy — read off `https://www.tiktok.com/setting` on 2026-08-11 while signed
 * in. See `docs/research/tiktok.com/SETTINGS.md` for the measurements and for
 * the parts of the live page that are deliberately not reproduced.
 *
 * Switch positions are the ones the measured account happened to have; they
 * exist to show both states, not because any of them mean anything here.
 */
export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: "manage-account",
    label: "Manage account",
    icon: "manage-account",
    groups: [
      {
        heading: "Account control",
        rows: [{ kind: "link", title: "Deactivate or delete account" }],
      },
      {
        heading: "Account information",
        rows: [
          {
            kind: "value",
            title: "Account region",
            description:
              "Your account region is initially set based on the time and place of registration.",
            value: "Vietnam",
          },
        ],
      },
    ],
  },
  {
    id: "privacy",
    label: "Privacy",
    icon: "privacy",
    groups: [
      {
        heading: "Discoverability",
        rows: [
          {
            kind: "switch",
            title: "Private account",
            description:
              "With a private account, only users you approve can follow you and watch your videos. Your existing followers won’t be affected.",
            on: false,
          },
        ],
      },
      {
        heading: "Interactions",
        rows: [
          {
            kind: "value",
            title: "Comments",
            description: "Who can comment on your posts",
            value: "Everyone",
          },
          {
            kind: "link",
            title: "Direct messages",
            description: "Who can send you messages",
          },
          { kind: "link", title: "Blocked accounts" },
        ],
      },
      {
        heading: "Data",
        rows: [
          {
            kind: "link",
            title: "Download your data",
            description: "Get a copy of your Nowa data",
          },
        ],
      },
    ],
  },
  {
    id: "push-notifications",
    label: "Push notifications",
    icon: "push-notifications",
    groups: [
      {
        heading: "Desktop notifications",
        rows: [
          {
            kind: "switch",
            title: "Allow in browser",
            description:
              "Stay on top of notifications for likes, comments, the latest videos, and more on desktop. You can turn them off anytime.",
            on: false,
          },
        ],
      },
      {
        heading: "Your preferences",
        description:
          "Your preferences will be synced automatically to the Nowa app.",
        rows: [
          {
            kind: "expand",
            title: "Interactions",
            description: "Likes, comments, new followers, mentions and tags",
          },
        ],
      },
      { rows: [{ kind: "expand", title: "In-app notifications" }] },
    ],
  },
  {
    id: "business-verification",
    label: "Business verification",
    icon: "business-verification",
    groups: [
      {
        rows: [
          {
            kind: "switch",
            title: "Business verification",
            description:
              "Verify your business to access marketing tools and exclusive features that better connect you with viewers.",
            on: false,
          },
        ],
      },
    ],
  },
  {
    id: "ads",
    label: "Ads",
    icon: "ads",
    groups: [
      {
        heading: "Manage the ads you see",
        muted: true,
        rows: [
          {
            kind: "link",
            title: "Manage ad topics",
            description: "Change factors used to tailor the ads you see.",
          },
          {
            kind: "link",
            title: "Mute advertisers",
            description:
              "Mute ads from specific advertisers who showed you ads recently on Nowa.",
          },
          {
            kind: "link",
            title: "Edit personal details",
            description:
              "Select the gender which may be used to tailor the ads you see.",
          },
        ],
      },
      {
        heading: "Manage your off-Nowa data",
        muted: true,
        rows: [
          {
            kind: "switch",
            title: "Targeted ads outside of Nowa",
            description:
              "With this setting, Nowa may show you ads on other websites and apps using information collected about you, both on and off Nowa. This setting controls the ads our advertising partners ask us to show you off Nowa. All your ad privacy choices on Nowa will continue to inform the ads we show you.",
            on: true,
          },
          {
            kind: "switch",
            title: "Using Off-Nowa activity for ad targeting",
            description:
              "With this setting, the ads you see on Nowa can be more tailored to your interests based on data that advertising partners share with us about your activity on their apps and websites. You will always see ads on Nowa based on what you do on Nowa or other data described in our privacy policy.",
            on: true,
          },
          {
            kind: "link",
            title: "Disconnect advertisers",
            description:
              "Stop tailoring ads with your off-Nowa data from an advertiser.",
          },
          {
            kind: "link",
            title: "Clear off-Nowa data",
            description:
              "Clear the off-Nowa data that advertisers have shared about you.",
          },
        ],
      },
    ],
  },
  {
    id: "screen-time",
    label: "Screen time",
    icon: "screen-time",
    groups: [
      {
        rows: [
          {
            kind: "value",
            title: "Daily screen time",
            description: "Get notified if you reach your time on Nowa.",
            value: "Off",
          },
          {
            kind: "value",
            title: "Sleep hours",
            description: "Get reminded when you’re in your sleep hours.",
            value: "Off",
          },
          {
            kind: "switch",
            title: "Weekly screen time updates",
            description: "Stay updated on your time from your Inbox.",
            on: true,
          },
          {
            kind: "expand",
            title: "Summary",
            description:
              "Your weekly metrics include your time on the app and on nowa.com.",
          },
        ],
      },
      {
        heading: "Help and resources",
        rows: [{ kind: "external", title: "Digital well-being tips" }],
      },
    ],
  },
  {
    id: "content-preferences",
    label: "Content preferences",
    icon: "content-preferences",
    groups: [
      {
        rows: [
          {
            kind: "link",
            title: "Filter keywords",
            description:
              "When you filter a keyword, you won’t see posts in your selected feeds that contain that word in any titles, descriptions, or stickers. Certain keywords can’t be filtered.",
          },
        ],
      },
    ],
  },
  {
    id: "accessibility",
    label: "Accessibility",
    icon: "accessibility",
    groups: [
      {
        rows: [
          {
            kind: "switch",
            title: "Increase color contrast",
            description:
              "This will only increase color contrast when visiting nowa.com on your computer.",
            on: false,
          },
        ],
      },
    ],
  },
];
