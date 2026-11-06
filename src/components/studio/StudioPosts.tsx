"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  POSTS_GRID,
  PostRow,
  PostRowSkeleton,
} from "@/components/studio/posts/PostRow";
import { useOpenStudioVideo } from "@/components/studio/StudioVideoModal";
import {
  Checkbox,
  EmptyState,
  FilterChip,
  Popover,
  StudioCard,
} from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { useDebounced } from "@/hooks/use-debounced";
import { useVideoChanges, withCounts } from "@/hooks/use-video-changes";
import type { VideoFrame } from "@/hooks/use-video-realtime";
import { messageFor } from "@/lib/api/errors";
import { listStudioPosts, type StudioPostQuery } from "@/lib/api/studio";
import { getVideo } from "@/lib/api/videos";
import {
  isLastPage,
  type SortOrder,
  type StudioPostSort,
  type VideoResponse,
  type VideoStatus,
} from "@/lib/api/types";
import { PRIVACY_LABEL, VISIBILITIES } from "@/lib/studio/overview";
import { COUNT_RANGES, nextSort, type PostSort } from "@/lib/studio/posts";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const STATUSES: { value: VideoStatus; label: string }[] = [
  { value: "PUBLISHED", label: "Posted" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PENDING_MODERATION", label: "Checking content" },
  { value: "PENDING_REVIEW", label: "Under review" },
  { value: "REJECTED", label: "Removed" },
  { value: "TAKEN_DOWN", label: "Taken down" },
  { value: "FAILED", label: "Upload failed" },
];

/**
 * Statuses the transcode and the automatic check move on by themselves, in seconds to minutes.
 * PENDING_REVIEW waits on an admin, which can take hours, so it is not polled.
 */
const SETTLING = new Set<VideoStatus>(["PROCESSING", "PENDING_MODERATION"]);
export const SETTLE_POLL_MS = 5_000;
/** How soon a new post, a count or a reviewer's verdict shows without a reload. */
export const POSTS_POLL_MS = 5_000;

const PRIVACY_OPTIONS = VISIBILITIES.map((value) => ({ value, label: PRIVACY_LABEL[value] }));
const NONE: never[] = [];

type PostFilters = Pick<
  StudioPostQuery,
  "views" | "likes" | "comments" | "visibility" | "status"
>;

/**
 * `/studio/content` — TikTok Studio's Posts table: every post in every state,
 * filtered by count ranges, privacy and status, searched by caption, sorted by
 * a column.
 */
export function StudioPosts() {
  const openVideo = useOpenStudioVideo();
  const [filters, setFilters] = useState<PostFilters>({});
  const [sort, setSort] = useState<PostSort | undefined>();
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  const query = useMemo(
    () => ({ ...filters, q, sort: sort?.key, order: sort?.order }),
    [filters, q, sort],
  );
  const queryKey = JSON.stringify(query);

  const [posts, setPosts] = useState<VideoResponse[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // The rows on screen answer this query; anything else means a fetch is on its way.
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== queryKey;
  // One controller per query; a page of it still in flight when the query changes is dropped.
  const controller = useRef<AbortController | null>(null);

  const load = useCallback(
    (pageNumber: number, signal: AbortSignal) =>
      listStudioPosts(
        { ...query, page: pageNumber, size: PAGE_SIZE },
        signal,
      ).then((result) => {
        if (signal.aborted) return;
        setPosts((current) => {
          if (pageNumber === 0) return result.content;
          // Offset pages shift when a post lands meanwhile; the row pushed over the edge comes again.
          const shown = new Set(current?.map((item) => item.id));
          return [...(current ?? []), ...result.content.filter((item) => !shown.has(item.id))];
        });
        setPage(pageNumber);
        setHasMore(!isLastPage(result.page));
        setError(null);
        setLoadedKey(queryKey);
      }),
    [query, queryKey],
  );

  useEffect(() => {
    const current = new AbortController();
    controller.current = current;
    load(0, current.signal).catch((cause: unknown) => {
      if (current.signal.aborted) return;
      setError(messageFor(cause));
      setLoadedKey(queryKey);
    });
    return () => current.abort();
  }, [load, queryKey]);

  // The next page is only asked once: `page` moves when it lands, so a second click would repeat it.
  const pendingMore = useRef<AbortSignal | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const loadMore = () => {
    const signal = controller.current?.signal;
    if (!signal || pendingMore.current === signal) return;
    pendingMore.current = signal;
    setLoadingMore(true);
    load(page + 1, signal)
      .catch((cause: unknown) => {
        if (!signal.aborted) toast.error(messageFor(cause));
      })
      .finally(() => {
        if (pendingMore.current === signal) pendingMore.current = null;
        setLoadingMore(false);
      });
  };

  // Bumped by every change made here; a poll that left before one would undo it, so it is dropped.
  const edits = useRef(0);
  const replace = (video: VideoResponse) => {
    edits.current += 1;
    setPosts(
      (current) =>
        current?.map((item) => (item.id === video.id ? video : item)) ?? null,
    );
  };
  const remove = (id: string) => {
    edits.current += 1;
    setPosts((current) => current?.filter((item) => item.id !== id) ?? null);
  };
  /**
   * The default order leads with pinned posts (video-service sorts them first), so a pin or unpin
   * moves the row: the first page is asked again for the server's order. Under a column the owner
   * picked, a pin moves nothing and the row is patched where it is.
   */
  const update = (video: VideoResponse) => {
    const before = posts?.find((item) => item.id === video.id);
    if (!sort && before && Boolean(before.pinnedAt) !== Boolean(video.pinnedAt)) {
      const signal = controller.current?.signal;
      if (signal)
        load(0, signal).catch((cause: unknown) => {
          if (!signal.aborted) toast.error(messageFor(cause));
        });
    }
    replace(video);
  };
  /** Rows whose counters a frame moved, and when — a poll that left before keeps the frame's. */
  const counted = useRef(new Map<string, { at: number; frame: VideoFrame }>());
  // A delete or pin made on the profile, in another tab or on another device lands here without a
  // reload; a view, like or comment from anyone moves its row's counters the moment it happens.
  useVideoChanges(posts?.map((video) => video.id) ?? [], {
    onUpdated: update,
    onDeleted: remove,
    onCounts: (frame) => {
      counted.current.set(frame.videoId, { at: performance.now(), frame });
      setPosts(
        (current) => current?.map((item) => (item.id === frame.videoId ? withCounts(item, frame) : item)) ?? null,
      );
    },
  });
  // Rows the pipeline is still working on are fetched again until they settle, so a verdict
  // shows up without a reload. Only those rows, by id: reloading the list would drop the pages
  // "Load more" added. No socket carries every verdict to the owner, so this polls.
  const settlingIds = posts?.filter((video) => SETTLING.has(video.status)).map((video) => video.id).join(",") ?? "";
  useEffect(() => {
    if (!settlingIds) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      for (const id of settlingIds.split(",")) {
        getVideo(id)
          .then((video) => setPosts((current) => current?.map((item) => (item.id === video.id ? video : item)) ?? null))
          // A miss is tried again next tick; a deleted video leaves with the next list load.
          .catch(() => {});
      }
    }, SETTLE_POLL_MS);
    return () => window.clearInterval(timer);
  }, [settlingIds]);
  // The first page is read again for new posts and fresh counts; nothing pushes either to the owner.
  // Its rows go on top and replace their old copies, so pages "Load more" added stay below.
  useEffect(() => {
    if (loading) return;
    const timer = window.setInterval(() => {
      const signal = controller.current?.signal;
      if (!signal || signal.aborted || document.visibilityState !== "visible") return;
      const before = edits.current;
      const startedAt = performance.now();
      listStudioPosts({ ...query, page: 0, size: PAGE_SIZE }, signal)
        .then((result) => {
          if (signal.aborted || edits.current !== before) return;
          const fresh = result.content.map((item) => {
            const framed = counted.current.get(item.id);
            return framed && framed.at >= startedAt ? withCounts(item, framed.frame) : item;
          });
          const top = new Set(fresh.map((item) => item.id));
          setPosts((current) => [...fresh, ...(current ?? []).filter((item) => !top.has(item.id))]);
        })
        // Tried again next tick.
        .catch(() => {});
    }, POSTS_POLL_MS);
    return () => window.clearInterval(timer);
  }, [loading, query]);
  const filterBy =
    <K extends keyof PostFilters>(key: K) =>
    (value: PostFilters[K]) =>
      setFilters((current) => ({ ...current, [key]: value }));
  const header = (label: string, key: StudioPostSort) => (
    <SortHeader
      label={label}
      order={sort?.key === key ? sort.order : undefined}
      onClick={() => setSort(nextSort(sort, key))}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <CheckChip
            label="Views"
            options={COUNT_RANGES}
            value={filters.views ?? NONE}
            onApply={filterBy("views")}
          />
          <CheckChip
            label="Likes"
            options={COUNT_RANGES}
            value={filters.likes ?? NONE}
            onApply={filterBy("likes")}
          />
          <CheckChip
            label="Comments"
            options={COUNT_RANGES}
            value={filters.comments ?? NONE}
            onApply={filterBy("comments")}
          />
          <CheckChip
            label="Privacy"
            options={PRIVACY_OPTIONS}
            value={filters.visibility ?? NONE}
            onApply={filterBy("visibility")}
          />
          <CheckChip
            label="Status"
            options={STATUSES}
            value={filters.status ?? NONE}
            onApply={filterBy("status")}
          />
        </div>
        <label className="flex h-9 w-[330px] items-center gap-2 rounded-[8px] border border-black/8 bg-white px-3">
          <Search className="h-4 w-4 flex-none" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for post description"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-black outline-none placeholder:text-black/34"
          />
        </label>
      </div>

      <StudioCard>
        <div
          className={cn(
            POSTS_GRID,
            "border-b border-black/8 px-5 py-3 text-[12px] leading-4 font-medium text-black/48",
          )}
        >
          {header("Content (Created on)", "NEWEST")}
          <span>Privacy</span>
          {header("Views", "VIEWS")}
          {header("Likes", "LIKES")}
          {header("Comments", "COMMENTS")}
          <span className="text-center">Actions</span>
        </div>

        {error && !loading ? (
          <EmptyState>{error}</EmptyState>
        ) : loading || !posts ? (
          <ul
            className="divide-y divide-black/8"
            role="status"
            aria-label="Loading"
          >
            {Array.from({ length: 5 }, (_, i) => (
              <PostRowSkeleton key={i} />
            ))}
          </ul>
        ) : posts.length === 0 &&
          (query.q || Object.values(filters).some((value) => value?.length)) ? (
          <EmptyState>No posts match these filters</EmptyState>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-[20px] leading-6 font-bold">No posts yet</p>
            <p className="text-[16px] text-black/65">
              Videos you post will appear here.
            </p>
            <Link
              href="/studio/upload"
              className="mt-2 flex h-11 w-[300px] items-center justify-center rounded-[4px] bg-[#fe2c55] text-[15px] font-semibold text-white hover:bg-[#ea284e]"
            >
              Upload your first video
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-black/8">
            {posts.map((video) => (
              <PostRow
                key={video.id}
                video={video}
                onChange={update}
                onDelete={remove}
                onOpen={() => openVideo(video.id, posts.map((post) => post.id))}
              />
            ))}
          </ul>
        )}
      </StudioCard>

      {hasMore && posts && (
        <button
          type="button"
          onClick={loadMore}
          disabled={loadingMore}
          className="mx-auto h-9 rounded-[8px] border border-black/8 bg-white px-5 text-[14px] font-semibold hover:bg-black/3 disabled:opacity-50"
        >
          Load more
        </button>
      )}
    </div>
  );
}

// TikTok's own chevrons; each sits in the middle of the box, so they are nudged apart.
const CHEVRON_UP =
  "M7.74 14.492a1 1 0 0 0 1.41.109L12 12.158l2.85 2.443a1 1 0 0 0 1.3-1.519l-3.174-2.72a1.5 1.5 0 0 0-1.952 0l-3.175 2.72a1 1 0 0 0-.108 1.41";
const CHEVRON_DOWN =
  "M7.74 10.35a1 1 0 0 1 1.41-.11L12 12.684l2.85-2.442a1 1 0 1 1 1.3 1.518l-3.174 2.721a1.5 1.5 0 0 1-1.952 0l-3.175-2.72a1 1 0 0 1-.108-1.41";

/** A sortable column title: grey until picked, then black with the live direction's chevron dark. */
function SortHeader({
  label,
  order,
  onClick,
}: {
  label: string;
  order: SortOrder | undefined;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Sort by ${label}${order ? (order === "DESC" ? ", high to low" : ", low to high") : ""}`}
      className={cn(
        "flex w-fit items-center gap-1 text-left transition-colors",
        order ? "text-black" : "hover:text-black",
      )}
    >
      {label}
      <span className="flex h-3.5 w-3.5 flex-none items-center justify-center rounded-[4px] border border-black/8">
        <svg viewBox="0 0 24 24" className="h-3 w-3" aria-hidden>
          <path
            d={CHEVRON_UP}
            transform="translate(0 -3)"
            className={cn(
              "transition-[fill] duration-200",
              order === "ASC" ? "fill-black" : "fill-black/34",
            )}
          />
          <path
            d={CHEVRON_DOWN}
            transform="translate(0 3)"
            className={cn(
              "transition-[fill] duration-200",
              order === "DESC" ? "fill-black" : "fill-black/34",
            )}
          />
        </svg>
      </span>
    </button>
  );
}

/**
 * A chip whose menu ticks any number of values, then Clear or Apply — as TikTok
 * Studio's Views, Likes, Comments and Privacy chips. Ticks are a draft until Apply;
 * closing the menu any other way drops them.
 */
function CheckChip<T extends string>({
  label,
  options,
  value,
  onApply,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T[];
  onApply: (value: T[]) => void;
}) {
  const [draft, setDraft] = useState<T[]>(value);
  const flip = (option: T) =>
    setDraft((current) =>
      current.includes(option)
        ? current.filter((item) => item !== option)
        : [...current, option],
    );

  return (
    <Popover
      className="top-[calc(100%+8px)] w-[217px] border border-black/8 py-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.08),0_4px_6px_-4px_rgba(0,0,0,0.08)]"
      trigger={({ open, toggle }) => (
        <FilterChip
          label={label}
          active={value.length > 0}
          open={open}
          onClick={() => {
            setDraft(value);
            toggle();
          }}
          onClear={() => onApply([])}
        />
      )}
    >
      {(close) => (
        <>
          <div className="p-2">
            {options.map((option) => (
              <label
                key={option.value}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2.5 text-[14px] whitespace-nowrap transition-colors hover:bg-black/4"
              >
                <Checkbox
                  checked={draft.includes(option.value)}
                  onChange={() => flip(option.value)}
                />
                {option.label}
              </label>
            ))}
          </div>
          <div className="flex gap-2 border-t border-black/8 p-3">
            <button
              type="button"
              onClick={() => {
                onApply([]);
                close();
              }}
              className="h-8 flex-1 rounded-[6px] border border-black/8 text-[14px] font-medium transition-colors hover:bg-black/3"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                close();
              }}
              className="h-8 flex-1 rounded-[6px] bg-[#fe2c55] text-[14px] font-medium text-white transition-colors hover:bg-[#ea284e]"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
