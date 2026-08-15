"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type SVGProps } from "react";

import { ActivityDrawer } from "@/components/layout/ActivityDrawer";
import { TikTokWordmark } from "@/components/layout/TikTokWordmark";
import {
  ActivityIcon,
  ExploreIcon,
  ForYouIcon,
  FollowingIcon,
  FriendsIcon,
  LiveIcon,
  MessagesIcon,
  MoreIcon,
  SearchIcon,
  UploadIcon,
} from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { cn } from "@/lib/utils";
import type { ActivityGroup, FooterSection, NavItem } from "@/types/tiktok";

const ICONS: Record<string, ComponentType<SVGProps<SVGSVGElement>>> = {
  "For You": ForYouIcon,
  Explore: ExploreIcon,
  Following: FollowingIcon,
  Friends: FriendsIcon,
  LIVE: LiveIcon,
  Messages: MessagesIcon,
  Activity: ActivityIcon,
  Upload: UploadIcon,
  More: MoreIcon,
};

/**
 * Sidebar. Source rule from the live site:
 *   width: 15rem; height: 100vh; position: fixed; display:flex;
 *   flex-direction: column; align-items:center; flex-shrink:0;
 *   overflow: clip hidden; overscroll-behavior: contain;
 *   background: var(--ui-page-flat-1); padding-inline: 16px;
 *   @media (max-width:1024px) { width: 4.5rem; border-right: 1px solid rgba(255,255,255,.12) }
 *
 * The 240px placeholder that reserves layout space lives in page.tsx, matching
 * the site's `.DivSideNavPlaceholderContainer` (z-index 99).
 *
 * Opening the Activity drawer swaps this element's rule set (found by diffing
 * the emotion class, `dznzmc` → `1r9paic`):
 *
 *   expanded   width: 15rem; @media (max-width:1024px) { width: 4.5rem;
 *                            border-right: 1px solid rgba(255,255,255,.12) }
 *   collapsed  width: 4.5rem; @media (max-width:1024px) { width: 4.5rem }
 *
 * Note the collapsed variant drops the border entirely — the drawer sitting
 * against it carries its own `border-inline` instead. The placeholder does not
 * change, so the feed never moves.
 */
export function SideNav({
  navItems,
  footerSections,
  activity,
}: {
  navItems: NavItem[];
  footerSections: FooterSection[];
  activity: { filters: readonly string[]; groups: ActivityGroup[] };
}) {
  const [activityOpen, setActivityOpen] = useState(false);
  // The highlighted row follows the URL, so every new route lights itself up
  // without touching the nav data.
  const pathname = usePathname();
  const { user, openLogin } = useSession();

  // Guest sidebar: Friends, Messages and Activity are absent, leaving the seven
  // rows measured on the live signed-out nav.
  const visibleNavItems = (user ? navItems : navItems.filter((item) => !item.authOnly))
    // Two rows are session-dependent rather than static: Profile has to point
    // at whoever is signed in, and Upload at the route that actually exists
    // here (the live site's is `/tiktokstudio/upload`).
    .map((item) => {
      if (item.label === "Profile" && user) {
        return { ...item, href: `/@${user.username}` };
      }
      if (item.label === "Upload") return { ...item, href: "/upload" };
      return item;
    });

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-[99] flex h-screen flex-none flex-col items-center px-4",
        "overflow-x-clip overflow-y-hidden overscroll-contain bg-[var(--tt-page)]",
        activityOpen
          ? "w-18"
          : "w-[var(--side-nav-width)] tt-1024:w-18 tt-1024:border-r tt-1024:border-[var(--tt-divider)]",
      )}
      style={{ overscrollBehavior: "contain" }}
    >
      {/* Fixed header block: logo (48px) + search (40px), 208px content width */}
      <div className={cn("flex-none", activityOpen ? "w-auto" : "w-52 tt-1024:w-auto")}>
        <div className="relative z-[100] flex h-12 items-center">
          <Link href="/" aria-label="TikTok" className="flex items-center gap-1.5">
            <TikTokWordmark
              className={cn(
                "h-6 w-auto text-white",
                activityOpen ? "hidden" : "tt-1024:hidden",
              )}
            />
          </Link>
        </div>

        <div
          className={cn(
            "flex w-full pt-4",
            activityOpen ? "justify-center" : "tt-1024:justify-center",
          )}
        >
          <SearchField collapsed={activityOpen} />
        </div>
      </div>

      {/* Scrolling block: nav + footer */}
      <div
        className={cn(
          "no-scrollbar flex-1 overflow-y-auto pt-3",
          activityOpen ? "w-auto" : "w-52 tt-1024:w-auto",
        )}
      >
        <nav className="flex flex-col">
          {visibleNavItems.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              avatarUrl={user?.avatarUrl ?? "/images/avatars/avatar-1.jpeg"}
              collapsed={activityOpen}
              active={item.href === pathname}
              selected={item.label === "Activity" && activityOpen}
              onClick={
                item.label === "Activity"
                  ? () => setActivityOpen((v) => !v)
                  : undefined
              }
            />
          ))}
        </nav>

        {/* `.SubMainNavContentContainer > .DivPrimaryButtonContainer` — present
            only for a signed-out viewer. Measured 200 × 40, `#FE2C55`,
            `border-radius: 6px`, 16px/500/21px, `margin-bottom: 24px`, which is
            what pushes the footer down to where the guest sidebar has it. */}
        {!user && (
          <div
            className={cn(
              // 16px above the button, 24px below it, and the 4px inset that
              // puts the 200px button inside the 208px nav column.
              "mb-6 px-1 pt-4",
              // The collapsed 4.5rem rail has no room for a text button; the
              // top bar's Log in pill stays reachable there.
              "tt-1024:hidden",
              activityOpen && "hidden",
            )}
          >
            <button
              type="button"
              onClick={openLogin}
              className="h-10 w-full rounded-[6px] bg-[var(--tt-red)] px-4 text-[16px] leading-[21px] font-medium text-white transition-colors hover:bg-[var(--tt-red-hover)]"
            >
              Log in
            </button>
          </div>
        )}

        <SidebarFooter sections={footerSections} hidden={activityOpen} />
      </div>

      <ActivityDrawer
        open={activityOpen}
        filters={activity.filters}
        groups={activity.groups}
        onClose={() => setActivityOpen(false)}
      />
    </div>
  );
}

/**
 * Nav row = TUX secondary button, 208×40, radius 6px, transparent background,
 * `.TUXButton-content` 204×32 with gap 12px, `.TUXButton-iconContainer` 32×32,
 * label 16px/500/21px. Active label colour #FF3B5C, inactive icon #F6F6F6.
 */
function NavRow({
  item,
  avatarUrl,
  collapsed = false,
  active = false,
  selected = false,
  onClick,
}: {
  item: NavItem;
  /** The viewer's avatar, which the Profile row renders in place of an icon. */
  avatarUrl: string;
  /** True while the Activity drawer holds the sidebar at 4.5rem. */
  collapsed?: boolean;
  /** The row whose href matches the current route. */
  active?: boolean;
  selected?: boolean;
  onClick?: () => void;
}) {
  const Icon = ICONS[item.label];

  const inner = (
    <span
      className={cn(
        "group inline-flex h-10 w-full items-center rounded-[6px]",
        "transition-colors hover:bg-[var(--tt-field)]",
        selected && "bg-[var(--tt-field)]",
      )}
    >
      <span
        className={cn(
          "flex h-8 w-full items-center gap-3",
          collapsed ? "justify-center" : "tt-1024:justify-center",
        )}
      >
        <span className="relative flex h-8 w-8 flex-none items-center justify-center">
          {item.label === "Profile" ? (
            // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
            <img
              src={avatarUrl}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : Icon ? (
            <Icon
              className={cn(
                "h-[19px] w-[19px]",
                active ? "text-[var(--tt-red-active)]" : "text-[var(--tt-icon)]",
              )}
            />
          ) : null}

          {item.badgeCount ? (
            <span className="absolute -right-1 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10px] font-bold leading-none text-white">
              {item.badgeCount}
            </span>
          ) : null}
        </span>

        <span
          className={cn(
            "truncate text-[16px] font-medium leading-[21px]",
            collapsed ? "hidden" : "tt-1024:hidden",
            active ? "text-[var(--tt-red-active)]" : "text-[var(--tt-text)]",
          )}
        >
          {item.label}
        </span>
      </span>
    </span>
  );

  if (item.kind === "link" && item.href) {
    return (
      <Link href={item.href} className="w-full">
        {inner}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={onClick ? selected : undefined}
      className="w-full text-left"
    >
      {inner}
    </button>
  );
}

/**
 * `.DivFooterContainer` — extracted verbatim:
 *
 *   position: relative; padding-top: 16px; padding-left: 8px;
 *   ::before { content: ""; position: absolute; left: 8px; right: 8px; top: 0;
 *              height: 1px; background: rgba(255,255,255,.12);
 *              transform: scaleY(.5) }            ← a hairline, not a border
 *   @media screen and (max-width: 1071px) { display: none }
 *
 *   .H4LinkListHeader  15px/700/22px, TikTokDisplayFont, cursor: pointer,
 *                      margin-top: 5px (0 on the first), color .5 → .9 when
 *                      its section is open
 *   .DivLinkContainer  margin-bottom: 8px; children flow inline and wrap
 *   .StyledNavLink     12px/600/16px, rgba(255,255,255,.5), inline-block,
 *                      margin-right: 6px, margin-top: 5px; :hover keeps the
 *                      same colour and adds no underline
 *   .SpanCopyright     same type as the links, inline-block, margin-top: 5px
 *
 * It is a **single-open accordion that starts fully collapsed** — the link
 * lists are not in the DOM until their heading is clicked, and clicking an open
 * heading closes it. The 1071px breakpoint is its own; it is not 1024.
 */
function SidebarFooter({
  sections,
  hidden,
}: {
  sections: FooterSection[];
  hidden: boolean;
}) {
  const [openSection, setOpenSection] = useState<string | null>(null);

  const toggle = (heading: string) =>
    setOpenSection((current) => (current === heading ? null : heading));

  return (
    <div
      className={cn(
        "relative pl-2 pt-4 tt-1071:hidden",
        "before:absolute before:inset-x-2 before:top-0 before:h-px",
        "before:bg-[var(--tt-divider)] before:[transform:scaleY(0.5)] before:content-['']",
        hidden && "hidden",
      )}
    >
      {sections.map((section, index) => {
        const open = openSection === section.heading;
        return (
          <div key={section.heading}>
            {/* The live site puts the handler on a bare `h3`. The tag is kept
                for fidelity, with role/tabIndex/keydown added so it is still
                operable from the keyboard. */}
            <h3
              role="button"
              tabIndex={0}
              aria-expanded={open}
              onClick={() => toggle(section.heading)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggle(section.heading);
                }
              }}
              className={cn(
                "cursor-pointer text-[15px] font-bold leading-[22px]",
                index === 0 ? "mt-0" : "mt-[5px]",
                open ? "text-[var(--tt-text)]" : "text-[var(--tt-text-muted)]",
              )}
            >
              {section.heading}
            </h3>

            {open && (
              <div className="mb-2">
                {section.links.map((link) => (
                  <span
                    key={link}
                    className="mr-1.5 mt-[5px] inline-block cursor-pointer text-[12px] font-semibold leading-4 text-[var(--tt-text-muted)]"
                  >
                    {link}
                  </span>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <span className="mt-[5px] inline-block pb-6 text-[12px] font-semibold leading-4 text-[var(--tt-text-muted)]">
        © 2026 TikTok
      </span>
    </div>
  );
}

/** Search field: 208×40, radius 999px, background rgba(255,255,255,.13). */
function SearchField({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div
      className={cn(
        "flex h-10 items-center rounded-full bg-[var(--tt-field)] py-1.5",
        collapsed
          ? "w-10 justify-center px-0"
          : "w-full px-2.5 tt-1024:w-10 tt-1024:justify-center tt-1024:px-0",
      )}
    >
      <SearchIcon className="h-4 w-4 flex-none text-[var(--tt-placeholder)]" />
      <input
        type="text"
        placeholder="Search"
        aria-label="Search"
        className={cn(
          "ml-2 w-full bg-transparent text-[15px] text-[var(--tt-text)] placeholder:text-[var(--tt-placeholder)] focus:outline-none",
          collapsed ? "hidden" : "tt-1024:hidden",
        )}
      />
    </div>
  );
}

