"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { useSession } from "@/components/session/SessionProvider";

/**
 * Fixed top-right actions: "Get Coins", "Get App", avatar.
 * Sits above the feed; the sidebar owns the top-left corner.
 *
 * The right offset tracks `--comment-sidebar-width` so the bar slides out of
 * the comment sidebar's way instead of overlapping its header — on the live
 * site the panel is `top: 0` with nothing above it. It eases `linear` to stay
 * locked to the sidebar, which uses the same easing.
 *
 * Signed out, the trailing slot holds a Log in pill instead of the avatar —
 * measured on the live guest bar at 76 × 32, `border-radius: 999px`,
 * `#FE2C55`, 15px/500/19px, `padding: 1px 8px`. Everything before the divider
 * is identical in both states.
 */
export function TopBar() {
  const { user, isLoading, openLogin } = useSession();
  const pathname = usePathname();

  // `/login` and `/signup` are the only routes with chrome of their own: the
  // live pages drop the sidebar and this bar for a header holding just the
  // logo and a help link. Nothing else on the site does, so the exception is
  // a check here rather than a second root layout.
  if (pathname.startsWith("/login") || pathname.startsWith("/signup")) {
    return null;
  }

  return (
    <div className="fixed top-3 z-[99] flex items-center gap-2 right-[calc(1.5rem+var(--comment-sidebar-width))] transition-[right] duration-300 ease-linear tt-1024:right-[calc(0.75rem+var(--comment-sidebar-width))]">
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

function CoinGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" fill="currentColor">
      <path d="M24 4a20 20 0 1 0 0 40 20 20 0 0 0 0-40Zm0 4a16 16 0 1 1 0 32 16 16 0 0 1 0-32Zm1.5 5h-3v2.2c-2.6.4-4.5 2.2-4.5 4.8 0 3 2.4 4.3 5.3 5 2.4.6 3.2 1.2 3.2 2.3 0 1.2-1.1 2-2.9 2-2 0-3.3-.9-3.5-2.4h-3.2c.2 2.8 2.2 4.7 5.1 5.1V35h3v-2.2c2.8-.4 4.8-2.2 4.8-5 0-3-2.3-4.3-5.4-5-2.4-.6-3.1-1.1-3.1-2.2 0-1.1 1-1.9 2.6-1.9 1.8 0 2.9.9 3.1 2.3h3.2c-.2-2.7-2.1-4.5-4.7-4.9V13Z" />
    </svg>
  );
}

function PhoneGlyph() {
  return (
    <svg viewBox="0 0 48 48" className="h-5 w-5" fill="currentColor">
      <path d="M15 3a5 5 0 0 0-5 5v32a5 5 0 0 0 5 5h18a5 5 0 0 0 5-5V8a5 5 0 0 0-5-5H15Zm0 4h18a1 1 0 0 1 1 1v32a1 1 0 0 1-1 1H15a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1Zm6 32h6a1 1 0 0 1 0 2h-6a1 1 0 0 1 0-2Z" />
    </svg>
  );
}
