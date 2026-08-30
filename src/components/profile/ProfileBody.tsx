"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import {
  EmptyGridIcon,
  FavoritesIcon,
  LikedIcon,
  PlayIcon,
  PrivacyLockIcon,
  ProfileVideosIcon,
  RepostIcon,
} from "@/components/icons";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCount } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import { cn } from "@/lib/utils";
import type { ProfileTab, ProfileVideo, UserProfile } from "@/types/tiktok";

const TABS: { id: ProfileTab; label: string; Icon: typeof PlayIcon }[] = [
  { id: "videos", label: "Videos", Icon: ProfileVideosIcon },
  { id: "reposts", label: "Reposts", Icon: RepostIcon },
  { id: "favorites", label: "Favorites", Icon: FavoritesIcon },
  { id: "liked", label: "Liked", Icon: LikedIcon },
];

const SORTS = ["Latest", "Popular", "Oldest"] as const;
type Sort = (typeof SORTS)[number];

const TAB_IDS = TABS.map((entry) => entry.id);

/** The tab named by `?tab=`, or "videos" for a missing or unknown value. */
function tabFromParam(value: string | null): ProfileTab {
  return TAB_IDS.includes(value as ProfileTab) ? (value as ProfileTab) : "videos";
}

/**
 * `.DivFeedTabWrapper` + `.DivVideoFeedV2` — the tab bar, its sort control and
 * the grid beneath them.
 *
 * Measured live (see `docs/research/tiktok.com/PROFILE.md`):
 *   tab        44px tall, padding-inline 32, 20px icon + 4px gap, label 18/600,
 *              active .9 / inactive .5 white
 *   underline  a real 2px element that *slides* (`transition: transform .3s`),
 *              not a border on the active tab
 *   grid       6 / 4 / 3 / 2 columns at 1200 / 840 / 600, gap 24px row 16px col
 *   tile       height/width 1.3265, radius 8, bottom gradient, view count
 *              bottom-left — and no caption, unlike the Explore tile
 */
/** The video grid, shared by the real tiles and their skeleton. */
const GRID_CLASS =
  "mt-4 grid grid-cols-6 gap-x-4 gap-y-6 tt-1200:grid-cols-4 tt-840:grid-cols-3 tt-600:grid-cols-2 tt-600:gap-3";

/**
 * Placeholder tiles in the profile grid. `count` is the caller's — it is the
 * caller that knows how large a page its own tab fetches.
 */
export function ProfileGridSkeleton({ count }: { count: number }) {
  return (
    <div className={GRID_CLASS}>
      {Array.from({ length: count }).map((_, i) => (
        <Skeleton key={i} className="aspect-[1/1.3265] w-full rounded-[8px]" />
      ))}
    </div>
  );
}

export function ProfileBody({
  profile,
  isOwner,
  onTabSelect,
  pendingTab,
  pendingCount = 0,
}: {
  profile: UserProfile;
  isOwner: boolean;
  /**
   * The tab whose videos are still in flight, and how many are coming. The
   * count is known before the videos themselves are — from the profile's video
   * total, or from the id list Favorites and Liked fetch first — so the grid
   * draws the tiles that will actually land instead of a fixed guess.
   */
  pendingTab?: ProfileTab | null;
  pendingCount?: number;
  /**
   * Fired when a tab is opened, so a page backed by real data can fetch that
   * tab's videos then rather than on load — Favorites and Liked are two
   * requests each, and most visits never open either.
   */
  onTabSelect?: (tab: ProfileTab) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  /**
   * The tab lives in the URL (`?tab=liked`) so that Close on the video overlay —
   * a `router.back()` — returns to the tab the viewer left, not always Videos.
   */
  const tab = tabFromParam(searchParams.get("tab"));
  const [sort, setSort] = useState<Sort>("Latest");

  const selectTab = (id: ProfileTab) => {
    const query = id === "videos" ? "" : `?tab=${id}`;
    router.replace(`${pathname}${query}`, { scroll: false });
    onTabSelect?.(id);
  };

  /**
   * Returning to `?tab=favorites` via Close remounts this page fresh, so the
   * tab's videos have to be re-requested — `onTabSelect` fires on click only.
   */
  useEffect(() => {
    if (tab !== "videos") onTabSelect?.(tab);
    // Mount only: a later tab change already goes through `selectTab`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const posts = useMemo(() => {
    const list = profile.posts[tab];
    if (sort === "Latest") return list;
    if (sort === "Oldest") return [...list].reverse();
    return [...list].sort((a, b) => b.views - a.views);
  }, [profile.posts, sort, tab]);

  const tabRowRef = useRef<HTMLDivElement>(null);

  return (
    <>
      <div className="relative flex items-center justify-between">
        <div ref={tabRowRef} className="flex">
          {TABS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === tab}
              onClick={() => selectTab(id)}
              className={cn(
                "flex h-11 items-center gap-1 px-8 text-[18px] leading-6 font-semibold transition-colors tt-840:px-4",
                id === tab
                  ? "text-[var(--tt-text)]"
                  : "text-[rgb(255_255_255/0.5)] hover:text-[var(--tt-text)]",
              )}
            >
              <Icon className="h-5 w-5 flex-none" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <SegmentedControl value={sort} onChange={setSort} />

        <Underline active={tab} rowRef={tabRowRef} />
      </div>

      {tab === pendingTab && pendingCount > 0 ? (
        <ProfileGridSkeleton count={pendingCount} />
      ) : posts.length === 0 ? (
        <EmptyState tab={tab} isOwner={isOwner} />
      ) : (
        <div className={GRID_CLASS}>
          {posts.map((post) => (
            <ProfileTile
              key={post.id}
              post={post}
              onOpen={() =>
                markOverlayOrigin(
                  window.location.pathname + window.location.search,
                  posts.map((entry) => entry.id),
                )
              }
            />
          ))}
        </div>
      )}
    </>
  );
}

/**
 * `.DivBottomLine` — one 2px bar translated under the active tab. It is
 * positioned from the real tab widths rather than from a hard-coded table,
 * because the labels are what set those widths.
 */
function Underline({
  active,
  rowRef,
}: {
  active: ProfileTab;
  rowRef: React.RefObject<HTMLDivElement | null>;
}) {
  const [box, setBox] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;

    const measure = () => {
      const index = TABS.findIndex((entry) => entry.id === active);
      const tab = row.children[index] as HTMLElement | undefined;
      if (tab) setBox({ left: tab.offsetLeft, width: tab.offsetWidth });
    };

    measure();
    // The tabs re-flow with the viewport, and the bar has to follow.
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [active, rowRef]);

  return (
    <div
      aria-hidden
      className="absolute bottom-0 left-0 h-0.5 bg-[var(--tt-text)] transition-transform duration-300"
      style={{
        width: box.width,
        transform: `translateX(${box.left}px)`,
      }}
    />
  );
}

/** `.TUXSegmentedControl` — Latest / Popular / Oldest. */
function SegmentedControl({
  value,
  onChange,
}: {
  value: Sort;
  onChange: (next: Sort) => void;
}) {
  return (
    <div className="flex h-9 flex-none items-center gap-0 rounded-[6px] bg-[var(--tt-field)] p-0.5 tt-600:hidden">
      {SORTS.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "h-8 rounded-[4px] px-2.5 py-1.5 text-[14px] leading-[18px] font-medium transition-colors",
            option === value
              ? "bg-[var(--tt-sheet-3)] text-[var(--tt-text)]"
              : "text-[var(--tt-text)] hover:bg-[rgb(255_255_255/0.08)]",
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}

/** `.DivItemContainerV2` — cover, view count, muted preview on hover. */
function ProfileTile({
  post,
  onOpen,
}: {
  post: ProfileVideo;
  /** Records the origin route and this grid's id list for the overlay. */
  onOpen: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  const preview = (playing: boolean) => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      // Autoplay can reject (e.g. reduced-power mode) — the poster stays up.
      void video.play().catch(() => {});
    } else {
      video.pause();
      video.currentTime = 0;
    }
  };

  return (
    <Link
      href={`/video/${encodeURIComponent(post.id)}`}
      onClick={onOpen}
      onMouseEnter={() => preview(true)}
      onMouseLeave={() => preview(false)}
      className="relative block aspect-[1/1.3265] overflow-hidden rounded-[8px] bg-[var(--tt-field)]"
    >
      <video
        ref={videoRef}
        // A video still transcoding has no playable URL yet, and `src=""` makes
        // the browser re-request the page itself. The poster carries the tile.
        src={post.videoUrl || undefined}
        // Backend videos come back without a thumbnail, and one shared
        // fallback image made every tile identical. With no poster the browser
        // paints the first frame instead — which needs the metadata, hence the
        // preload here and nowhere else.
        poster={post.posterUrl || undefined}
        muted
        loop
        playsInline
        preload={post.posterUrl ? "none" : "metadata"}
        className="h-full w-full object-cover"
      />

      {post.isPrivate && (
        <div
          title="Only you can watch this video"
          className="pointer-events-none absolute top-2 left-2 flex items-center gap-1 rounded-[4px] bg-black/60 px-1.5 py-1 text-[12px] leading-4 font-semibold text-white"
        >
          <PrivacyLockIcon className="h-3.5 w-3.5" />
          <span className="sr-only">Private</span>
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/30 to-transparent px-3 pt-5 pb-2 text-[14px] font-semibold text-white">
        <PlayIcon className="h-3.5 w-3.5" />
        {formatCount(post.views)}
      </div>
    </Link>
  );
}

/**
 * `.DivErrorContainer` — the 92px disc, a 24/700 title and a 16/400 line.
 * The copy is the tab's: only the Videos tab invites an upload, and only the
 * owner is invited at all.
 */
function EmptyState({ tab, isOwner }: { tab: ProfileTab; isOwner: boolean }) {
  const copy: Record<ProfileTab, { title: string; description: string }> = {
    videos: isOwner
      ? { title: "Upload your first video", description: "Your videos will appear here" }
      : { title: "No content", description: "This user has no videos" },
    reposts: {
      title: "No reposts yet",
      description: isOwner
        ? "Videos you repost will appear here"
        : "Reposted videos will appear here",
    },
    favorites: {
      title: "No favorites yet",
      description: isOwner
        ? "Videos you favorite will appear here"
        : "This user's favorites are private",
    },
    liked: {
      title: "No liked videos yet",
      description: isOwner
        ? "Videos you like will appear here"
        : "This user's liked videos are private",
    },
  };

  return (
    <div className="flex flex-col items-center pt-45 text-center">
      <div className="flex h-23 w-23 items-center justify-center rounded-full bg-[#2d2d2d]">
        <EmptyGridIcon className="h-11 w-11 text-[var(--tt-icon)]" />
      </div>

      <p className="mt-6 text-[24px] leading-[30px] font-bold text-[var(--tt-text)]">
        {copy[tab].title}
      </p>
      <p className="mt-2 text-[16px] leading-[21px] text-[var(--tt-text-secondary)]">
        {copy[tab].description}
      </p>
    </div>
  );
}
