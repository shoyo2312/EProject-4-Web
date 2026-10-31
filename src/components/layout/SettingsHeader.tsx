"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import {
  ActivityIcon,
  MessagesIcon,
  PlusIcon,
  SearchIcon,
} from "@/components/icons";
import { ActivityDrawer } from "@/components/layout/ActivityDrawer";
import { NowaWordmark } from "@/components/layout/NowaWordmark";
import { AccountMenu } from "@/components/layout/TopBar";
import { useSession } from "@/components/session/SessionProvider";
import { useNotifications } from "@/hooks/use-notifications";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { formatBadgeCount } from "@/lib/format";

/**
 * `/setting`'s header. The live page drops the sidebar on this one route and
 * puts this bar across the top instead. Measured live at 1920px:
 *
 *   bar     fixed, 60 tall, #121212, `box-shadow: 0 1px 1px rgba(255,255,255,.12)`,
 *           `padding: 0 24px 0 16px`, logo / search / actions spaced apart
 *   logo    118 × 42, in a 300-wide left column
 *   search  500 × 46, radius 92px, rgba(255,255,255,.12); a 16px input, a
 *           1 × 28 divider, then a 52-wide button around a 24px glyph
 *   upload  116 × 36, radius 2px, rgba(255,255,255,.08); 20px "+", "Upload" 16/600
 *   icons   messages then inbox, 32 × 32, 32 after Upload and 16 apart;
 *           the 32px avatar 24 after
 *
 * Unlike the rail's search field, this one is a real input: submitting it goes
 * straight to the results page, as the live header does.
 */
export function SettingsHeader() {
  const router = useRouter();
  const { user, openLogin } = useSession();
  const inbox = useNotifications();
  const [activityOpen, setActivityOpen] = useState(false);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-[100] flex h-15 items-center justify-between bg-[#121212] pr-6 pl-4 shadow-[0_1px_1px_rgba(255,255,255,0.12)]">
        <div className="w-[300px] flex-none tt-1024:w-auto">
          <Link href="/" aria-label="Nowa home" className="inline-flex">
            <NowaWordmark className="h-[42px] w-auto text-white" />
          </Link>
        </div>

        <form
          role="search"
          onSubmit={(event) => {
            event.preventDefault();
            const entry = String(new FormData(event.currentTarget).get("q") ?? "").trim();
            if (entry) router.push(`/search?q=${encodeURIComponent(entry)}`);
          }}
          className="mx-4 flex h-[46px] w-[500px] min-w-0 items-center rounded-[92px] bg-[rgb(255_255_255/0.12)] tt-600:hidden"
        >
          <input
            name="q"
            type="search"
            placeholder="Search"
            aria-label="Search"
            autoComplete="off"
            className="h-full min-w-0 flex-1 bg-transparent pl-4 text-[16px] leading-[21px] text-[var(--tt-text)] caret-[#ff3b5c] outline-none placeholder:text-[var(--tt-placeholder)]"
          />
          <span className="h-7 w-px flex-none bg-[rgb(255_255_255/0.12)]" />
          <button
            type="submit"
            aria-label="Search"
            className="flex h-full w-[52px] flex-none items-center justify-center rounded-r-[92px] text-[var(--tt-placeholder)] transition-colors hover:bg-white/[0.04]"
          >
            <SearchIcon className="h-6 w-6" />
          </button>
        </form>

        <div className="flex flex-none items-center">
          <Link
            href="/upload"
            className="flex h-9 w-[116px] items-center justify-center gap-2 rounded-[2px] bg-[rgb(255_255_255/0.08)] text-[16px] leading-6 font-semibold text-[var(--tt-text)] transition-colors hover:bg-[rgb(255_255_255/0.12)] tt-840:w-9"
          >
            <PlusIcon className="h-5 w-5 flex-none" />
            <span className="tt-840:hidden">Upload</span>
          </Link>

          {/* Inert, like the rail's Messages row: there is no chat UI yet.
              Wire its onClick here once there is. */}
          <button
            type="button"
            aria-label="Messages"
            className="ml-8 flex h-8 w-8 items-center justify-center text-[var(--tt-text)]"
          >
            <MessagesIcon className="h-[26px] w-[26px]" />
          </button>

          <button
            type="button"
            aria-label="Activity"
            aria-expanded={activityOpen}
            onClick={user ? () => setActivityOpen((was) => !was) : openLogin}
            className="relative ml-4 flex h-8 w-8 items-center justify-center text-[var(--tt-text)]"
          >
            <ActivityIcon className="h-8 w-8" />
            {inbox.unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--tt-red)] px-1 text-[10px] leading-none font-bold text-white">
                {formatBadgeCount(inbox.unreadCount)}
              </span>
            )}
          </button>

          {/* 32 tall like the live slot — the inline avatar's button runs a
              few px taller, which centring would push 3px up. */}
          <div className="ml-6 flex h-8">
            {user ? (
              <AccountMenu />
            ) : (
              // Signed out there is no menu to open; the default avatar asks
              // for a login, as the rail's Profile row does.
              <button type="button" aria-label="Log in" onClick={openLogin}>
                {/* eslint-disable-next-line @next/next/no-img-element -- same CDN avatar as AccountMenu */}
                <img
                  src={DEFAULT_AVATAR}
                  alt=""
                  width={32}
                  height={32}
                  className="h-8 w-8 rounded-full object-cover"
                />
              </button>
            )}
          </div>
        </div>
      </header>

      <ActivityDrawer
        placement="header"
        open={activityOpen}
        inbox={inbox}
        onClose={() => setActivityOpen(false)}
      />
    </>
  );
}
