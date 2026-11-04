"use client";

import { ChevronLeft, FolderMinus, House, MessageCircleMore, SquareActivity, SquarePlus } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { useSession } from "@/components/session/SessionProvider";
import { StudioRangeProvider, useStudioRange } from "@/components/studio/StudioRange";
import { RangeSelect } from "@/components/studio/ui";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/studio", label: "Home", icon: House, exact: true },
  { href: "/studio/content", label: "Posts", icon: FolderMinus, exact: false },
  { href: "/studio/analytics", label: "Analytics", icon: SquareActivity, exact: false },
  { href: "/studio/comment", label: "Comments", icon: MessageCircleMore, exact: false },
] as const;

/** The tabs analytics carries in the header, as TikTok does. Followers has no backend yet. */
const ANALYTICS_TABS = [
  { href: "/studio/analytics", label: "Overview" },
  { href: "/studio/analytics/content", label: "Content" },
  { href: "/studio/analytics/viewers", label: "Viewers" },
] as const;

/**
 * Nowa Studio's frame: TikTok Studio's light theme, its own 68px header and
 * 248px sidebar, in place of the feed's dark shell. It fills the root layout's
 * row edge to edge, so nothing of the feed shows around it.
 *
 * Every screen inside is about the signed-in creator, so a guest is asked to
 * log in instead of being shown empty numbers.
 */
export function StudioShell({ children }: { children: React.ReactNode }) {
  const { user, isLoading, openLogin } = useSession();

  return (
    <StudioRangeProvider>
      <div className="flex h-screen w-full overflow-hidden bg-[#f8f8f8] font-sans text-black">
        <aside className="flex w-[248px] flex-none flex-col border-r border-black/8">
          <Link href="/studio" className="flex h-[68px] flex-none items-center gap-1.5 px-5">
            <Image
              src="/images/brand/nowa-icon.png"
              alt=""
              width={171}
              height={183}
              className="h-7 w-auto rounded-[5px]"
            />
            <span className="text-[21px] leading-none font-bold tracking-tight">Nowa</span>
            <span className="text-[19px] leading-none font-normal">Studio</span>
          </Link>
          <StudioNav />
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <StudioHeader avatarUrl={user?.avatarUrl} />
          <main className="min-h-0 flex-1 overflow-y-auto px-8 pt-8 pb-12">
            {isLoading ? null : user ? (
              children
            ) : (
              <div className="flex flex-col items-center gap-4 pt-24 text-center">
                <p className="text-[20px] font-bold">Log in to Nowa Studio</p>
                <p className="text-[14px] text-black/65">
                  See how your posts are doing and manage comments in one place.
                </p>
                <button
                  type="button"
                  onClick={openLogin}
                  className="h-11 w-[300px] rounded-[8px] bg-[#fe2c55] text-[16px] font-semibold text-white hover:bg-[#ea284e]"
                >
                  Log in
                </button>
              </div>
            )}
          </main>
        </div>
      </div>
    </StudioRangeProvider>
  );
}

function StudioNav() {
  const pathname = usePathname();

  return (
    <nav className="flex min-h-0 flex-1 flex-col px-5 pt-8 pb-12">
      <Link
        href="/upload"
        className="flex h-9 items-center gap-2 rounded-[8px] bg-[#fe2c55] px-3 text-[14px] leading-5 font-medium text-white transition-colors hover:bg-[#ea284e]"
      >
        <SquarePlus className="h-4 w-4" strokeWidth={2} />
        Upload
      </Link>

      <p className="mt-6 mb-2 pl-0.5 text-[10px] leading-[13px] font-bold text-black/34 uppercase">
        Manage
      </p>
      <ul className="flex flex-col gap-1">
        {NAV.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-[35px] items-center gap-2.5 rounded-[8px] border px-2.5 text-[14px] leading-4 font-medium transition-colors",
                  active
                    ? "border-black/8 bg-black/5 text-black"
                    : "border-transparent text-black/65 hover:bg-black/3",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>

      <Link
        href="/"
        className="mt-auto flex items-center gap-1 text-[14px] leading-[18px] font-medium text-black/65 hover:text-black"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Nowa
      </Link>
    </nav>
  );
}

function StudioHeader({ avatarUrl }: { avatarUrl?: string }) {
  const pathname = usePathname();
  const { days, setDays } = useStudioRange();
  const onAnalyticsTab = ANALYTICS_TABS.some((tab) => tab.href === pathname);

  return (
    <header className="flex h-[68px] flex-none items-center justify-between gap-6 border-b border-black/8 px-8">
      <nav className="flex h-full items-stretch gap-6">
        {onAnalyticsTab &&
          ANALYTICS_TABS.map((tab) => {
            const active = tab.href === pathname;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center border-b-2 pt-0.5 text-[14px] font-medium transition-colors",
                  active ? "border-black text-black" : "border-transparent text-black/34 hover:text-black/65",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
      </nav>

      <div className="flex items-center gap-3">
        {onAnalyticsTab && <RangeSelect days={days} onChange={setDays} />}
        {avatarUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- the viewer's own avatar, any host user-service allowed
          <img
            src={avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-8 w-8 rounded-full object-cover"
          />
        )}
      </div>
    </header>
  );
}
