import type {
  FooterSection,
  LoginOption,
  NavItem,
  SettingsSection,
  ShareTarget,
} from "@/types/tiktok";

/**
 * The fixed parts of the UI — nav, footer, the auth modals' option lists, the
 * share sheet's targets, Explore's categories and the `/setting` layout. None
 * of it is content: everything a viewer reads about videos, people or comments
 * comes from the backend.
 */

/**
 * The login modal's option list, verbatim and in order from the live modal.
 * The four third-party rows carry their brand colour only; see `AuthModal`
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
 * The signup modal's option list. It is not the login list minus a row: there
 * is no QR option, and the email row is worded differently.
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
 * Sidebar navigation — order, labels and hrefs are taken verbatim from the live
 * site's `.DivMainNavContainer` (10 children, in order). "Messages", "Activity"
 * and "More" render as buttons, not links. Profile has no href of its own:
 * `SideNav` points it at the signed-in viewer, and a guest gets the login modal.
 */
export const NAV_ITEMS: NavItem[] = [
  { label: "For You", kind: "link", href: "/" },
  { label: "Explore", kind: "link", href: "/explore" },
  { label: "Following", kind: "link", href: "/following" },
  { label: "Friends", kind: "link", href: "/friends", authOnly: true },
  { label: "Messages", kind: "button", authOnly: true },
  { label: "Activity", kind: "button", authOnly: true },
  { label: "Upload", kind: "link", href: "/nowastudio/upload" },
  { label: "Profile", kind: "link" },
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
            action: "comment-audience",
          },
          {
            kind: "link",
            title: "Direct messages",
            description: "Who can send you messages",
            action: "dm-audience",
          },
          {
            kind: "link",
            title: "Blocked accounts",
            action: "blocked-accounts",
          },
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
            action: "browser-notifications",
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
            action: "screen-time-limit",
          },
          {
            kind: "value",
            title: "Sleep hours",
            description: "Get reminded when you’re in your sleep hours.",
            value: "Off",
            action: "sleep-hours",
          },
          {
            kind: "switch",
            title: "Weekly screen time updates",
            description: "Stay updated on your time from your Inbox.",
            on: true,
            action: "weekly-screen-time",
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
            action: "high-contrast",
          },
        ],
      },
    ],
  },
];
