"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";

/**
 * Fixed top-right actions: "Get Coins", "Get App", avatar.
 * Sits above the feed; the sidebar owns the top-left corner.
 *
 * Hidden entirely while the feed comment panel is open — `Feed` toggles
 * `.comments-open` on <html>, and the live site keeps the panel at `top: 0`
 * with nothing floating above its header.
 *
 * Signed out, the trailing slot holds a Log in pill instead of the avatar —
 * measured on the live guest bar at 76 × 32, `border-radius: 999px`,
 * `#FE2C55`, 15px/500/19px, `padding: 1px 8px`. Everything before the divider
 * is identical in both states.
 */
export function TopBar() {
  const { user, isLoading, openLogin } = useSession();
  const pathname = usePathname();
  const [commentsOpen, setCommentsOpen] = useState(false);

  // `Feed` writes `.comments-open` on <html> so chrome outside the feed tree
  // can react without a shared React context. Observe the class rather than
  // reading it once — the bar mounts before the feed effect may have run.
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setCommentsOpen(root.classList.contains("comments-open"));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // `/login` and `/signup` are the only routes with chrome of their own: the
  // live pages drop the sidebar and this bar for a header holding just the
  // logo and a help link. Nothing else on the site does, so the exception is
  // a check here rather than a second root layout.
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  // The single-video view carries the owner's own controls (Follow, or Delete /
  // Private for your own upload) in its right column, so the floating avatar bar
  // is redundant there and is hidden — matching the request to drop this chrome
  // on `/video/{id}`.
  if (pathname.startsWith("/video/")) {
    return null;
  }

  // Comment sidebar owns the top-right corner while open; do not render over it.
  if (commentsOpen) {
    return null;
  }

  return (
    <div className="fixed top-3 right-6 z-[99] flex items-center gap-2 tt-1024:right-3">
      {/*<button*/}
      {/*  type="button"*/}
      {/*  className="flex h-9 items-center gap-2 rounded-[8px] px-3 text-[15px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"*/}
      {/*>*/}
      {/*  <CoinGlyph />*/}
      {/*  <span className="tt-1024:hidden">Get Coins</span>*/}
      {/*</button>*/}

      {/*<button*/}
      {/*  type="button"*/}
      {/*  className="flex h-9 items-center gap-2 rounded-[8px] px-3 text-[15px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"*/}
      {/*>*/}
      {/*  <PhoneGlyph />*/}
      {/*  <span className="tt-1024:hidden">Get App</span>*/}
      {/*</button>*/}

      <div className="ml-1 border-l border-[var(--tt-divider)] pl-3">
        {user ? (
          <AccountMenu />
        ) : isLoading ? (
          // The avatar's own footprint, measured on the signed-in bar: 32 x 32,
          // fully round, flush with the divider. A guest sees this branch only
          // until the bootstrap effect commits — with no token there is no
          // `/me` to wait for — so matching the avatar rather than the Log in
          // pill is what keeps the slot still in the case that actually waits.
          <div className="h-8 w-8 animate-pulse rounded-full bg-[var(--tt-field)]" />
        ) : (
          <button
            type="button"
            onClick={openLogin}
            className="h-8 w-[76px] rounded-full bg-[var(--tt-red)] px-2 text-[15px] leading-[19px] font-medium text-white transition-colors hover:bg-[var(--tt-red-hover)]"
          >
            Log in
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * The avatar, and the menu behind it.
 *
 * Logging out is a real request, not a local reset: `POST /auth/logout`
 * blacklists the access token server-side, so a token that leaked before the
 * click stops working immediately instead of living out its 15 minutes.
 */
function AccountMenu() {
  const { user, signOut } = useSession();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((was) => !was)}
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- avatars come from an arbitrary CDN host, which next/image would have to allow-list */}
        <img
          src={user.avatarUrl}
          alt="Your profile"
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover"
        />
      </button>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-[100] cursor-default"
            onClick={() => setOpen(false)}
          />
          <div
            role="menu"
            className="absolute right-0 z-[101] mt-2 w-44 overflow-hidden rounded-[8px] bg-[#2f2e2e] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
          >
            <Link
              href={`/@${user.username}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[15px] text-[var(--tt-text)] hover:bg-white/10"
            >
              View profile
            </Link>
            <Link
              href="/upload"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-[15px] text-[var(--tt-text)] hover:bg-white/10"
            >
              Upload
            </Link>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                signOut();
              }}
              className="block w-full px-4 py-2 text-left text-[15px] text-[var(--tt-text)] hover:bg-white/10"
            >
              Log out
            </button>
          </div>
        </>
      )}
    </div>
  );
}

