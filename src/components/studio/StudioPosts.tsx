"use client";

import { ChevronsUpDown, Ellipsis, Search, SquareActivity } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import { PostCell } from "@/components/studio/PostCell";
import { EmptyState, FilterChip, MenuOption, Popover, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { Modal } from "@/components/ui/modal";
import { messageFor } from "@/lib/api/errors";
import { listStudioPosts } from "@/lib/api/studio";
import { isLastPage, type StudioPostSort, type VideoResponse, type VideoStatus, type VideoVisibility } from "@/lib/api/types";
import { deleteVideo, updateVideoCommentsSetting, updateVideoVisibility } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { PRIVACY_LABEL } from "@/lib/studio/overview";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 20;
const VISIBILITIES: VideoVisibility[] = ["PUBLIC", "FRIENDS", "PRIVATE"];
const STATUSES: { value: VideoStatus; label: string }[] = [
  { value: "PUBLISHED", label: "Posted" },
  { value: "PROCESSING", label: "Processing" },
  { value: "PENDING_MODERATION", label: "Checking content" },
  { value: "PENDING_REVIEW", label: "Under review" },
  { value: "REJECTED", label: "Removed" },
  { value: "TAKEN_DOWN", label: "Taken down" },
  { value: "FAILED", label: "Upload failed" },
];

const GRID = "grid grid-cols-[minmax(0,1fr)_120px_96px_96px_104px_96px] items-center gap-4";

/**
 * `/studio/content` — TikTok Studio's Posts table: every post in every state,
 * filtered by privacy and status, searched by caption, sorted by a column.
 */
export function StudioPosts() {
  const [visibility, setVisibility] = useState<VideoVisibility | undefined>();
  const [status, setStatus] = useState<VideoStatus | undefined>();
  const [sort, setSort] = useState<StudioPostSort>("NEWEST");
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  const [posts, setPosts] = useState<VideoResponse[] | null>(null);
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(
    (pageNumber: number, signal?: AbortSignal) =>
      listStudioPosts({ visibility, status, q, sort, page: pageNumber, size: PAGE_SIZE }, signal).then((result) => {
        setPosts((current) => (pageNumber === 0 ? result.content : [...(current ?? []), ...result.content]));
        setPage(pageNumber);
        setHasMore(!isLastPage(result.page));
        setError(null);
      }),
    [visibility, status, q, sort],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(0, controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(messageFor(cause));
    });
    return () => controller.abort();
  }, [load]);

  const replace = (video: VideoResponse) =>
    setPosts((current) => current?.map((item) => (item.id === video.id ? video : item)) ?? null);
  const remove = (id: string) => setPosts((current) => current?.filter((item) => item.id !== id) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ChoiceChip
            label="Privacy"
            options={VISIBILITIES.map((value) => ({ value, label: PRIVACY_LABEL[value] }))}
            value={visibility}
            onApply={setVisibility}
          />
          <ChoiceChip label="Status" options={STATUSES} value={status} onApply={setStatus} />
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
        <div className={cn(GRID, "border-b border-black/8 px-5 py-3 text-[12px] leading-4 text-black/50")}>
          <SortHeader label="Content (Created on)" active={sort === "NEWEST"} onClick={() => setSort("NEWEST")} />
          <span>Privacy</span>
          <SortHeader label="Views" active={sort === "VIEWS"} onClick={() => setSort("VIEWS")} />
          <SortHeader label="Likes" active={sort === "LIKES"} onClick={() => setSort("LIKES")} />
          <SortHeader label="Comments" active={sort === "COMMENTS"} onClick={() => setSort("COMMENTS")} />
          <span className="text-center">Actions</span>
        </div>

        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : !posts ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => (
              <StudioSkeleton key={i} className="h-[72px]" />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center">
            <p className="text-[20px] leading-6 font-bold">No posts yet</p>
            <p className="text-[16px] text-black/65">Videos you post will appear here.</p>
            <Link
              href="/upload"
              className="mt-2 flex h-11 w-[300px] items-center justify-center rounded-[4px] bg-[#fe2c55] text-[15px] font-semibold text-white hover:bg-[#ea284e]"
            >
              Upload your first video
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-black/8">
            {posts.map((video) => (
              <PostRow key={video.id} video={video} onChange={replace} onDelete={remove} />
            ))}
          </ul>
        )}
      </StudioCard>

      {hasMore && posts && (
        <button
          type="button"
          onClick={() => load(page + 1).catch((cause: unknown) => toast.error(messageFor(cause)))}
          className="mx-auto h-9 rounded-[8px] border border-black/8 bg-white px-5 text-[14px] font-semibold hover:bg-black/3"
        >
          Load more
        </button>
      )}
    </div>
  );
}

function SortHeader({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("flex items-center gap-1 text-left", active ? "font-semibold text-black" : "hover:text-black")}
    >
      {label}
      <ChevronsUpDown className="h-3 w-3" />
    </button>
  );
}

/** A chip whose menu picks one value with checkboxes, then Clear or Apply — as TikTok's Privacy chip. */
function ChoiceChip<T extends string>({
  label,
  options,
  value,
  onApply,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T | undefined;
  onApply: (value: T | undefined) => void;
}) {
  const [draft, setDraft] = useState<T | undefined>(value);

  return (
    <Popover
      className="w-[220px] pb-0"
      trigger={({ open, toggle }) => (
        <FilterChip
          label={label}
          active={value !== undefined}
          open={open}
          onClick={() => {
            setDraft(value);
            toggle();
          }}
        />
      )}
    >
      {(close) => (
        <>
          {options.map((option) => (
            <label key={option.value} className="flex h-10 cursor-pointer items-center gap-3 px-4 text-[14px] hover:bg-black/4">
              <input
                type="checkbox"
                checked={draft === option.value}
                onChange={() => setDraft(draft === option.value ? undefined : option.value)}
                className="h-4 w-4 accent-[#fe2c55]"
              />
              {option.label}
            </label>
          ))}
          <div className="mt-2 flex gap-2 border-t border-black/8 p-3">
            <button
              type="button"
              onClick={() => {
                onApply(undefined);
                close();
              }}
              className="h-8 flex-1 rounded-[4px] border border-black/12 text-[14px] font-semibold hover:bg-black/3"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                close();
              }}
              className="h-8 flex-1 rounded-[4px] bg-[#fe2c55] text-[14px] font-semibold text-white hover:bg-[#ea284e]"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}

function PostRow({
  video,
  onChange,
  onDelete,
}: {
  video: VideoResponse;
  onChange: (video: VideoResponse) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const run = (action: Promise<VideoResponse>) =>
    action.then(onChange).catch((cause: unknown) => toast.error(messageFor(cause)));

  return (
    <li className={cn(GRID, "px-5 py-4 text-[14px]")}>
      <PostCell video={video} href={`/studio/analytics/${video.id}`} />

      <Popover
        className="w-[160px]"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="w-fit rounded-[4px] px-2 py-1 text-left font-medium hover:bg-black/4"
          >
            {PRIVACY_LABEL[video.visibility]} ▾
          </button>
        )}
      >
        {(close) =>
          VISIBILITIES.map((value) => (
            <MenuOption
              key={value}
              label={PRIVACY_LABEL[value]}
              selected={value === video.visibility}
              onClick={() => {
                close();
                if (value !== video.visibility) void run(updateVideoVisibility(video.id, value));
              }}
            />
          ))
        }
      </Popover>

      <span>{formatCount(video.viewCount)}</span>
      <span>{formatCount(video.likeCount)}</span>
      <span>{video.commentCount === null ? "–" : formatCount(video.commentCount)}</span>

      <div className="flex items-center justify-center gap-1">
        <Link
          href={`/studio/analytics/${video.id}`}
          aria-label="Analytics"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-black/5"
        >
          <SquareActivity className="h-4 w-4" />
        </Link>
        <RowMenu
          commentsOff={video.commentsDisabled}
          onToggleComments={() => run(updateVideoCommentsSetting(video.id, !video.commentsDisabled))}
          onDelete={() => setConfirming(true)}
        />
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(false)} className="w-[400px] rounded-[8px] bg-white p-6 text-center text-black">
          <p className="text-[20px] font-bold">Delete this post?</p>
          <p className="mt-2 text-[14px] text-black/65">It is removed from your profile and from everyone&apos;s feed.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 flex-1 rounded-[4px] border border-black/12 font-semibold hover:bg-black/3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                deleteVideo(video.id)
                  .then(() => {
                    onDelete(video.id);
                    toast.success("Post deleted");
                  })
                  .catch((cause: unknown) => toast.error(messageFor(cause)))
                  .finally(() => setConfirming(false))
              }
              className="h-10 flex-1 rounded-[4px] bg-[#fe2c55] font-semibold text-white hover:bg-[#ea284e]"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </li>
  );
}

function RowMenu({
  commentsOff,
  onToggleComments,
  onDelete,
}: {
  commentsOff: boolean;
  onToggleComments: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover
      align="end"
      className="w-[200px]"
      trigger={({ toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="More actions"
          className="flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-black/5"
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      )}
    >
      {(close) => (
        <>
          <MenuOption
            label={commentsOff ? "Turn on comments" : "Turn off comments"}
            selected={false}
            onClick={() => {
              close();
              onToggleComments();
            }}
          />
          <button
            type="button"
            onClick={() => {
              close();
              onDelete();
            }}
            className="flex h-10 w-full items-center px-4 text-left text-[14px] text-[#fe2c55] hover:bg-black/4"
          >
            Delete
          </button>
        </>
      )}
    </Popover>
  );
}

function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const id = window.setTimeout(() => setSettled(value), ms);
    return () => window.clearTimeout(id);
  }, [value, ms]);
  return settled;
}
