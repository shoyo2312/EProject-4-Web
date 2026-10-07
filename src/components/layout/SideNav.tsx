"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { ActivityDrawer } from "@/components/layout/ActivityDrawer";
import { SearchDrawer } from "@/components/layout/SearchDrawer";
import { NowaWordmark } from "@/components/layout/NowaWordmark";
import { NavRow } from "@/components/layout/side-nav/NavRow";
import { SearchField } from "@/components/layout/side-nav/SearchField";
import { SidebarFooter } from "@/components/layout/side-nav/SidebarFooter";
import { useSession } from "@/components/session/SessionProvider";
import { useNotifications } from "@/hooks/use-notifications";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { cn } from "@/lib/utils";
import type { FooterSection, NavItem } from "@/types/tiktok";

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
}: {
  navItems: NavItem[];
  footerSections: FooterSection[];
}) {
  // One inbox for both readers: the rail's badge and the drawer's list are the
  // same unread set, and fetching it twice would let the two disagree.
  const inbox = useNotifications();
  const [activityOpen, setActivityOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  // Both drawers sit in the same slot beside the rail, so opening one closes
  // the other, and either one collapses the rail the same way.
  const collapsed = activityOpen || searchOpen;
  // Below 1024px the rail is icon-only regardless of the drawers (the `tt-1024:`
  // classes on every label). The row labels only exist in the DOM when neither
  // this nor `collapsed` is true, so a hover tip stands in for them otherwise.
  const [railBelow, setRailBelow] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 1024px)");
    const sync = () => setRailBelow(query.matches);
    sync();
    query.addEventListener("change", sync);
    return () => query.removeEventListener("change", sync);
  }, []);
  const iconOnly = collapsed || railBelow;
  // The highlighted row follows the URL, so every new route lights itself up
  // without touching the nav data.
  const pathname = usePathname();
  const { user, isLoading, openLogin } = useSession();
  // Until `/me` settles the viewer is unknown, not signed out. Rendering the
  // guest sidebar first and then swapping it made the nav jump twice on every
  // reload: three auth-only rows appearing, and the Log in block leaving.
  const showGuest = !user && !isLoading;

  // Guest sidebar: Friends, Messages and Activity are absent, leaving the seven
  // rows measured on the live signed-out nav.
  const visibleNavItems = (showGuest ? navItems.filter((item) => !item.authOnly) : navItems)
    // Two rows are session-dependent rather than static: Profile has to point
    // at whoever is signed in, and Upload at the route that actually exists
    // here (the live site's is `/tiktokstudio/upload`).
    .map((item) => {
      if (item.label === "Profile" && user) {
        return { ...item, href: `/@${user.username}` };
      }
      if (item.label === "Upload") return { ...item, href: "/upload" };
      // The static badge in the nav data was a placeholder; this is the real
      // count. Zero drops the badge entirely rather than painting a "0".
      if (item.label === "Activity") {
        return { ...item, badgeCount: inbox.unreadCount || undefined };
      }
      return item;
    });

  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-[99] flex h-screen flex-none flex-col items-center px-4",
        "overflow-x-clip overflow-y-hidden overscroll-contain bg-[var(--tt-page)]",
        collapsed
          ? "w-18"
          : "w-[var(--side-nav-width)] tt-1024:w-18 tt-1024:border-r tt-1024:border-[var(--tt-divider)]",
      )}
      style={{ overscrollBehavior: "contain" }}
    >
      {/*
        `.DivAnimationCover` — the piece that makes the live collapse smooth:

          position: absolute; inset-inline-start: 0; top: 0; height: 100%;
          width: calc(12.5rem) → 4.5rem; transition: width 400ms;
          background-color: var(--ui-page-flat-1);

        The rail's own width snaps, with no transition at all (measured
        `transition-duration: 0s` on `.DivSideNavContainer`). Nothing about the
        layout is animated — what eases is this opaque band painting the page
        colour where the nav used to be, retracting over 400ms while the rows
        translate out over 200ms above it. Animating the layout instead is what
        makes the collapse stutter: the rows reflow into a 40px column and only
        then start moving.

        It is the first child and sets no stacking context, so everything after
        it paints on top.
      */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute inset-y-0 start-0 z-[2] bg-[var(--tt-page)]",
          "transition-[width] duration-[400ms]",
          collapsed ? "w-18" : "w-[12.5rem] tt-1024:w-18",
        )}
      />

      {/* Fixed header block: logo (48px) + search (40px), 208px content width */}
      <div className={cn("relative z-[4] flex-none", collapsed ? "w-auto" : "w-52 tt-1024:w-auto")}>
        <div className="relative flex h-12 items-center">
          {/* The hiding class goes on the link, not on the wordmark: the
              wordmark sets its own `inline-flex`, and Tailwind v4 emits that
              utility after `hidden`, so the two fight and the mark stays on
              screen behind the drawer. */}
          <Link
            href="/"
            aria-label="Nowa"
            className={cn(
              "flex items-center gap-1.5",
              collapsed ? "hidden" : "tt-1024:hidden",
            )}
          >
            <NowaWordmark className="h-6 w-auto text-white" />
          </Link>
        </div>

        <div
          className={cn(
            "flex w-full pt-4",
            collapsed ? "justify-center" : "tt-1024:justify-center",
          )}
        >
          <SearchField
            collapsed={collapsed}
            iconOnly={iconOnly}
            onOpen={() => {
              setActivityOpen(false);
              setSearchOpen(true);
            }}
          />
        </div>
      </div>

      {/* Scrolling block: nav + footer */}
      <div
        className={cn(
          "no-scrollbar relative z-[3] flex-1 overflow-y-auto pt-3",
          // The live rows fade out over the same 400ms the cover takes to
          // retract (measured on `.TUXButton-label`), so the rail empties
          // before the panel is uncovered rather than snapping to bare icons.
          "transition-opacity duration-[400ms]",
          collapsed && "opacity-0",
          // The column keeps its 208px width even while the rail is at 4.5rem —
          // this is what the live site does (`DivMainNavContainer` measured 208
          // wide at x = -68 with the panel open). `items-center` on the rail
          // then pushes it to x = (72 - 208) / 2 = -68 in the same frame the
          // rail snaps, and `overflow-x-clip` takes the rows off screen whole.
          // Letting it shrink to `w-auto` instead centres a ~122px column at
          // x = -25, so the row labels stay half visible beside the panel and
          // the collapse reads as a stutter rather than a cut.
          //
          // Nothing here is transitioned, on purpose: the live rail animates no
          // layout at all. Only the cover above eases.
          "w-52 tt-1024:w-auto",
        )}
      >
        <nav className="flex flex-col">
          {visibleNavItems.map((item) => (
            <NavRow
              key={item.label}
              item={item}
              avatarUrl={user?.avatarUrl ?? DEFAULT_AVATAR}
              collapsed={collapsed}
              iconOnly={iconOnly}
              active={item.href === pathname}
              selected={item.label === "Activity" && activityOpen}
              onClick={
                item.label === "Activity"
                  ? () => {
                      setSearchOpen(false);
                      setActivityOpen((v) => !v);
                    }
                  : undefined
              }
            />
          ))}
        </nav>

        {/* `.SubMainNavContentContainer > .DivPrimaryButtonContainer` — present
            only for a signed-out viewer. Measured 200 × 40, `#FE2C55`,
            `border-radius: 6px`, 16px/500/21px, `margin-bottom: 24px`, which is
            what pushes the footer down to where the guest sidebar has it. */}
        {showGuest && (
          <div
            className={cn(
              // 16px above the button, 24px below it, and the 4px inset that
              // puts the 200px button inside the 208px nav column.
              "mb-6 px-1 pt-4",
              // The collapsed 4.5rem rail has no room for a text button; the
              // top bar's Log in pill stays reachable there.
              "tt-1024:hidden",
              collapsed && "hidden",
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

        <SidebarFooter sections={footerSections} hidden={collapsed} />
      </div>

      <ActivityDrawer
        open={activityOpen}
        inbox={inbox}
        onClose={() => setActivityOpen(false)}
      />

      <SearchDrawer open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
