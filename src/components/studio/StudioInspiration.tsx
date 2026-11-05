"use client";

import { Bookmark, Heart, Play, User } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

import { EmptyState, StudioSkeleton } from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { useSavedVideos } from "@/hooks/use-saved-videos";
import { useStompTopic } from "@/hooks/use-stomp-topic";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { messageFor } from "@/lib/api/errors";
import { listSavedVideos } from "@/lib/api/interactions";
import { getTrending } from "@/lib/api/recommendations";
import type { UserProfileResponse, VideoResponse } from "@/lib/api/types";
import { getProfiles } from "@/lib/api/users";
import { getVideosByIds } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { markOverlayOrigin } from "@/lib/overlay-origin";
import { EXPLORE_CATEGORIES, EXPLORE_CATEGORY_HASHTAGS } from "@/lib/site-config";
import { cn } from "@/lib/utils";

/** The whole chart: recommendation-service serves at most 100 rows. */
const TRENDING_LIMIT = 100;

/** video-service's `max-page-size`: `/videos/batch` silently drops ids past it. */
const VIDEO_BATCH = 50;

const SAVED_PAGE = 50;

/** Videos shown on a creator card, as on TikTok. */
const CREATOR_VIDEOS = 3;

/** TikTok numbers the first ten creators only. */
const RANKED_CREATORS = 10;

export type InspirationTab = "trending" | "mine";

/**
 * `/studio/inspiration` — TikTok Studio's Inspiration: the last 24 hours'
 * trending posts, ranked, the creators behind them, and the posts the creator
 * kept for later. "My inspiration" is the viewer's Favorites: the bookmark on a
 * card is the same save the feed's bookmark makes, so there is one list, not two.
 *
 * The category chips are Explore's: each maps to the hashtag its clips carry
 * (`EXPLORE_CATEGORY_HASHTAGS`), and the chart is filtered on it here, so a
 * category shows what is trending in it rather than a search. TikTok's region
 * filter and Recommended tab have no backend here and are left out.
 */
export function StudioInspiration({ tab }: { tab: InspirationTab }) {
  return tab === "trending" ? <Trending /> : <MyInspiration />;
}

/* --- Trending -------------------------------------------------------------- */

type TrendingView = "posts" | "creators";

/** The chart's posts in `category`, still in chart order. "All" is the whole chart. */
export function inCategory(videos: VideoResponse[], category: string): VideoResponse[] {
  const tag = EXPLORE_CATEGORY_HASHTAGS[category];
  return tag ? videos.filter((video) => video.tags?.includes(tag)) : videos;
}

function Trending() {
  const [view, setView] = useState<TrendingView>("posts");
  const [category, setCategory] = useState<string>(EXPLORE_CATEGORIES[0]);
  const query = useStudioQuery("inspiration:trending", loadTrending);
  useRefreshWhileOpen(query.reload);
  const shown = query.data ? inCategory(query.data, category) : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="no-scrollbar flex gap-2 overflow-x-auto">
        {EXPLORE_CATEGORIES.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={category === option}
            onClick={() => setCategory(option)}
            className={cn(
              "h-8 flex-none rounded-full border px-3 text-[14px] font-medium whitespace-nowrap transition-colors",
              category === option
                ? "border-black bg-black text-white"
                : "border-black/8 bg-white text-black/65 hover:bg-black/3",
            )}
          >
            {option}
          </button>
        ))}
      </div>

      <div className="flex gap-2" role="tablist">
        {(["posts", "creators"] as const).map((option) => (
          <button
            key={option}
            type="button"
            role="tab"
            aria-selected={view === option}
            onClick={() => setView(option)}
            className={cn(
              "h-8 rounded-[8px] px-3 text-[14px] font-medium transition-colors",
              view === option ? "bg-black text-white" : "bg-black/5 text-black/50 hover:text-black/65",
            )}
          >
            {option === "posts" ? "Posts" : "Creators"}
          </button>
        ))}
      </div>

      {query.error ? (
        <EmptyState>{query.error}</EmptyState>
      ) : !shown ? (
        <PostsSkeleton />
      ) : shown.length === 0 ? (
        <EmptyState>{category === EXPLORE_CATEGORIES[0] ? "Nothing is trending yet" : `Nothing in ${category} is trending yet`}</EmptyState>
      ) : view === "posts" ? (
        <PostsGrid videos={shown} ranked />
      ) : (
        <CreatorsGrid videos={shown} />
      )}
    </div>
  );
}

/** recommendation-service rebuilds the chart once a minute (`reco.trending-rebuild-millis`). */
export const TRENDING_REFRESH_MS = 60_000;

/**
 * How long after an approval frame the chart is fetched. chat-service and recommendation-service
 * read the same verdict in separate consumer groups, so the frame can beat the ranking it announces.
 * ponytail: a fixed wait; have recommendation-service announce its own rebuild if it ever lags more.
 */
export const APPROVAL_SETTLE_MS = 2_500;

/**
 * Fetches the chart again shortly after any video is approved (chat-service's `/topic/feed`
 * frame; recommendation-service ranks it on the same verdict), and, as a fallback for a dropped
 * socket or a re-tag, every rebuild and when the tab comes back into view. Hidden tabs skip the poll.
 */
function useRefreshWhileOpen(reload: () => void) {
  const latest = useRef(reload);
  const settle = useRef<number | undefined>(undefined);
  useEffect(() => {
    latest.current = reload;
  });
  useStompTopic("/topic/feed", () => {
    // A burst of approvals is one fetch, after the last of them.
    window.clearTimeout(settle.current);
    settle.current = window.setTimeout(() => latest.current(), APPROVAL_SETTLE_MS);
  });
  useEffect(() => () => window.clearTimeout(settle.current), []);
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") latest.current();
    };
    const timer = window.setInterval(refresh, TRENDING_REFRESH_MS);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
}

async function loadTrending(signal: AbortSignal): Promise<VideoResponse[]> {
  const ranked = await getTrending(TRENDING_LIMIT, signal);
  const ids = ranked.map((row) => row.videoId);
  const chunks: string[][] = [];
  for (let from = 0; from < ids.length; from += VIDEO_BATCH) chunks.push(ids.slice(from, from + VIDEO_BATCH));
  // Each batch answers in the order asked, so the chart's order survives; a video
  // that has since gone is just absent, and the ranks close up behind it.
  return (await Promise.all(chunks.map((chunk) => getVideosByIds(chunk, signal)))).flat();
}

export interface TrendingCreator {
  userId: string;
  /** Their best-ranked trending posts, best first. */
  videos: VideoResponse[];
}

/**
 * The chart's creators, ranked by their best post — the first time each one
 * appears — with up to `perCreator` of their posts in chart order.
 */
export function creatorsOf(videos: VideoResponse[], perCreator = CREATOR_VIDEOS): TrendingCreator[] {
  const byCreator = new Map<string, VideoResponse[]>();
  for (const video of videos) {
    const own = byCreator.get(video.userId);
    if (!own) byCreator.set(video.userId, [video]);
    else if (own.length < perCreator) own.push(video);
  }
  return [...byCreator].map(([userId, own]) => ({ userId, videos: own }));
}

function CreatorsGrid({ videos }: { videos: VideoResponse[] }) {
  const creators = creatorsOf(videos);
  const ids = creators.map((creator) => creator.userId).join(",");
  // At most 100 creators from 100 posts — user-service's batch cap, so one call.
  const profiles = useStudioQuery(`inspiration:creators:${ids}`, () => getProfiles(ids.split(",")));

  if (profiles.error) return <EmptyState>{profiles.error}</EmptyState>;
  if (!profiles.data) return <CreatorsSkeleton />;

  // An account the viewer may not see (a block either way) is absent from the
  // answer, so its card is dropped and the ranks close up behind it.
  const byId = new Map(profiles.data.map((profile) => [profile.userId, profile]));
  const shown = creators.flatMap((creator) => {
    const profile = byId.get(creator.userId);
    return profile ? [{ ...creator, profile }] : [];
  });

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5">
      {shown.map((creator, index) => (
        <li key={creator.userId}>
          <CreatorCard
            profile={creator.profile}
            videos={creator.videos}
            rank={index < RANKED_CREATORS ? index + 1 : undefined}
          />
        </li>
      ))}
    </ul>
  );
}

function CreatorCard({
  profile,
  videos,
  rank,
}: {
  profile: UserProfileResponse;
  videos: VideoResponse[];
  rank: number | undefined;
}) {
  const name = profile.displayName || profile.username || "Nowa user";
  const avatar = profile.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatars come from any host user-service allowed
    <img src={profile.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-9 w-9 rounded-full object-cover" />
  ) : (
    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/8">
      <User className="h-4 w-4" strokeWidth={2} />
    </span>
  );
  const open = () => markOverlayOrigin(window.location.pathname, videos.map((video) => video.id));

  return (
    <div className="relative flex flex-col gap-3 rounded-[12px] border border-black/8 bg-white p-4">
      {rank !== undefined && <RankBadge rank={rank} className="top-0 left-0 -translate-x-1/3 -translate-y-1/3" />}
      <div className="flex items-center gap-2.5">
        {/* The profile opens in a new tab, as Studio's own Profile link does. */}
        {profile.username ? (
          <Link href={`/@${profile.username}`} target="_blank" className="flex-none hover:opacity-80">
            {avatar}
          </Link>
        ) : (
          avatar
        )}
        <span className="flex min-w-0 flex-1 flex-col">
          {profile.username ? (
            <Link
              href={`/@${profile.username}`}
              target="_blank"
              className="truncate text-[15px] leading-5 font-semibold text-black hover:underline"
            >
              {name}
            </Link>
          ) : (
            <span className="truncate text-[15px] leading-5 font-semibold text-black">{name}</span>
          )}
          {profile.bio && <span className="truncate text-[12px] leading-4 text-black/50">{profile.bio}</span>}
        </span>
        <span className="flex flex-none flex-col items-end">
          <span className="text-[15px] leading-5 font-semibold text-black">{formatCount(profile.followerCount)}</span>
          <span className="text-[12px] leading-4 text-black/50">Followers</span>
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {videos.map((video) => (
          <Link
            key={video.id}
            href={`/video/${video.id}`}
            onClick={open}
            className="relative block aspect-[3/4] overflow-hidden rounded-[6px] bg-black/8 hover:opacity-90"
          >
            {video.thumbnailUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, as in PostThumb
              <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            )}
            <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
              <Play className="h-2.5 w-2.5 fill-current" />
              {formatCount(video.viewCount)}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}

/* --- My inspiration -------------------------------------------------------- */

function MyInspiration() {
  const [videos, setVideos] = useState<VideoResponse[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (after: string | null, signal?: AbortSignal) => {
    setLoading(true);
    try {
      const page = await listSavedVideos(after ?? undefined, SAVED_PAGE, signal);
      // A save whose video has since gone is absent here, so a page can come back short.
      const rows = await getVideosByIds(page.videoIds, signal);
      setVideos((current) => (after ? [...(current ?? []), ...rows] : rows));
      setCursor(page.nextCursor);
      setHasMore(page.hasMore && page.nextCursor !== null);
      setError(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    load(null, controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(messageFor(cause));
    });
    return () => controller.abort();
  }, [load]);

  if (error) return <EmptyState>{error}</EmptyState>;
  if (!videos) return <PostsSkeleton />;
  if (videos.length === 0 && !hasMore) {
    return (
      <div className="flex flex-col items-center gap-2 pt-24 text-center">
        <p className="text-[20px] font-bold">No posts yet</p>
        <p className="text-[14px] text-black/65">Posts you add to “My inspiration” will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PostsGrid videos={videos} ranked={false} />
      {hasMore && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(cursor).catch((cause: unknown) => toast.error(messageFor(cause)))}
          className="mx-auto h-9 rounded-[8px] border border-black/8 bg-white px-5 text-[14px] font-semibold hover:bg-black/3 disabled:opacity-50"
        >
          Load more
        </button>
      )}
    </div>
  );
}

/* --- Shared ---------------------------------------------------------------- */

const POSTS_GRID = "grid grid-cols-[repeat(auto-fill,minmax(176px,1fr))] gap-x-4 gap-y-6";

function PostsGrid({ videos, ranked }: { videos: VideoResponse[]; ranked: boolean }) {
  const { isSaved, toggleSave } = useSavedVideos();
  // Close on the video page goes back here, and its up/down step through this grid.
  const open = () => markOverlayOrigin(window.location.pathname, videos.map((video) => video.id));

  return (
    <ul className={POSTS_GRID}>
      {videos.map((video, index) => (
        <li key={video.id}>
          <PostCard
            video={video}
            rank={ranked ? index + 1 : undefined}
            saved={isSaved(video.id)}
            onToggleSave={() => toggleSave(video.id)}
            onOpen={open}
          />
        </li>
      ))}
    </ul>
  );
}

/** Gold, silver, bronze for the top three, as on TikTok; grey below. */
const RANK_STYLE = ["bg-[#f5c242] text-black", "bg-[#c9ccd1] text-black", "bg-[#d79a6a] text-black"];

function RankBadge({ rank, className }: { rank: number; className?: string }) {
  return (
    <span
      className={cn(
        "absolute flex h-5 min-w-5 items-center justify-center rounded-[4px] px-1 text-[11px] font-semibold",
        RANK_STYLE[rank - 1] ?? "border border-black/8 bg-white text-black/65",
        className,
      )}
    >
      {rank}
    </span>
  );
}

function PostCard({
  video,
  rank,
  saved,
  onToggleSave,
  onOpen,
}: {
  video: VideoResponse;
  rank: number | undefined;
  saved: boolean;
  onToggleSave: () => void;
  onOpen: () => void;
}) {
  return (
    <div className="group relative flex flex-col gap-2">
      <Link href={`/video/${video.id}`} onClick={onOpen} className="flex flex-col gap-2">
        <span className="relative block aspect-[3/4] overflow-hidden rounded-[8px] bg-black/8">
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, as in PostThumb
            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          )}
          {rank !== undefined && <RankBadge rank={rank} className="top-2 left-2" />}
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-3 bg-gradient-to-t from-black/60 to-transparent px-2 pt-6 pb-1.5 text-[12px] font-semibold text-white">
            <span className="flex items-center gap-1">
              <Play className="h-3 w-3 fill-current" />
              {formatCount(video.viewCount)}
            </span>
            <span className="flex items-center gap-1">
              <Heart className="h-3 w-3 fill-current" />
              {formatCount(video.likeCount)}
            </span>
          </span>
        </span>
        <span className="line-clamp-2 text-[14px] leading-[18px] font-medium text-black">
          {video.title || video.description}
        </span>
      </Link>

      {/* A sibling of the link, not inside it: a button nested in an <a> is invalid HTML. */}
      <button
        type="button"
        onClick={onToggleSave}
        aria-pressed={saved}
        aria-label={saved ? "Remove from My inspiration" : "Add to My inspiration"}
        className={cn(
          "absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-[6px] bg-black/55 text-white transition-opacity hover:bg-black/70 focus-visible:opacity-100",
          saved ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
      >
        <Bookmark className={cn("h-4 w-4", saved && "fill-[#face15] text-[#face15]")} strokeWidth={2} />
      </button>
    </div>
  );
}

function PostsSkeleton() {
  return (
    <ul className={POSTS_GRID} aria-hidden>
      {Array.from({ length: 10 }, (_, index) => (
        <li key={index} className="flex flex-col gap-2">
          <StudioSkeleton className="aspect-[3/4] rounded-[8px]" />
          <StudioSkeleton className="h-4 w-3/4" />
        </li>
      ))}
    </ul>
  );
}

function CreatorsSkeleton() {
  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(300px,1fr))] gap-5" aria-hidden>
      {Array.from({ length: 6 }, (_, index) => (
        <li key={index}>
          <StudioSkeleton className="h-[230px] rounded-[12px]" />
        </li>
      ))}
    </ul>
  );
}
