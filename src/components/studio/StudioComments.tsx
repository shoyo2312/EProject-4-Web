"use client";

import { Search } from "lucide-react";
import { useState } from "react";

import { DateRangeChip, type DayRange } from "@/components/studio/DateRangeChip";
import { PostThumb } from "@/components/studio/PostCell";
import { Thread } from "@/components/studio/StudioVideoComments";
import { useOpenStudioVideo } from "@/components/studio/StudioVideoModal";
import { EmptyState, FilterChip, MenuOption, Popover, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { useCommentContext } from "@/hooks/use-comment-context";
import { useDebounced } from "@/hooks/use-debounced";
import { useInboxComments } from "@/hooks/use-inbox-comments";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { messageFor } from "@/lib/api/errors";
import { listStudioPosts } from "@/lib/api/studio";
import type { CommentResponse } from "@/lib/api/types";
import { dayRangeToInstants } from "@/lib/studio/metrics";

type StatusFilter = "VISIBLE" | "HELD" | undefined;

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: undefined, label: "All comments" },
  { value: "HELD", label: "Held for review" },
  { value: "VISIBLE", label: "Published" },
];

/**
 * `/studio/comment` — every comment on every post, newest first, narrowed by
 * kind, post, date and text. Held comments are approved or deleted here;
 * anything can be replied to or deleted.
 */
/**
 * `initialVideoId`: a Posts row's "View comments" opens this already narrowed to that post. It
 * only seeds the filter, so the route keys this on it: another post in the URL is a fresh inbox.
 */
export function StudioComments({ initialVideoId }: { initialVideoId?: string }) {
  const openVideo = useOpenStudioVideo();
  const [status, setStatus] = useState<StatusFilter>();
  const [videoId, setVideoId] = useState<string | undefined>(initialVideoId);
  const [range, setRange] = useState<DayRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);

  const query = { status, videoId, q, ...dayRangeToInstants(range.start, range.end) };
  const { comments, setComments, hasMore, error, loadMore, loadingMore } = useInboxComments(JSON.stringify(query));

  const { authors, videos } = useCommentContext(comments ?? []);
  const posts = useStudioQuery("comment-posts", (signal) => listStudioPosts({ size: 50 }, signal));

  const drop = (commentId: string) => setComments((current) => current?.filter((c) => c.commentId !== commentId) ?? null);
  const replace = (comment: CommentResponse) =>
    setComments((current) => current?.map((c) => (c.commentId === comment.commentId ? comment : c)) ?? null);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <MenuChip
            label={STATUS_OPTIONS.find((o) => o.value === status)!.label}
            active={status !== undefined}
            options={STATUS_OPTIONS.map((o) => ({ key: o.label, label: o.label, selected: o.value === status, pick: () => setStatus(o.value) }))}
          />
          <MenuChip
            label={videoId ? "1 post" : "All posts"}
            active={videoId !== undefined}
            options={[
              { key: "all", label: "All posts", selected: !videoId, pick: () => setVideoId(undefined) },
              ...(posts.data?.content ?? []).map((video) => ({
                key: video.id,
                label: video.title || video.description || "Untitled",
                selected: video.id === videoId,
                pick: () => setVideoId(video.id),
              })),
            ]}
          />
          <DateRangeChip value={range} onApply={setRange} />
        </div>
        <label className="flex h-9 w-[330px] items-center gap-2 rounded-[8px] border border-black/8 bg-white px-3">
          <Search className="h-4 w-4 flex-none" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search for comments"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-black outline-none placeholder:text-black/34"
          />
        </label>
      </div>

      <StudioCard>
        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : !comments ? (
          <div className="flex flex-col gap-3 p-5">
            {[0, 1, 2].map((i) => (
              <StudioSkeleton key={i} className="h-16" />
            ))}
          </div>
        ) : comments.length === 0 && !hasMore ? (
          <EmptyState>No comments yet</EmptyState>
        ) : (
          <ul className="divide-y divide-black/8">
            {comments.map((comment) => (
              // The thread as on the post's own comment page — the owner's replies under the comment,
              // Creator and "A ▸ B" labels, delete asked first — with the post beside it.
              <li key={comment.commentId} className="flex items-start gap-3 px-3">
                <div className="min-w-0 flex-1">
                  <Thread
                    comment={comment}
                    ownerId={videos.get(comment.videoId)?.userId}
                    authors={authors}
                    onChanged={replace}
                    onDeleted={drop}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => openVideo(comment.videoId)}
                  className="mt-4 flex-none hover:opacity-80"
                  aria-label="Open the post"
                >
                  <PostThumb url={videos.get(comment.videoId)?.thumbnailUrl ?? null} className="h-14 w-[42px]" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </StudioCard>

      {hasMore && comments && (
        <button
          type="button"
          onClick={() => loadMore().catch((cause: unknown) => toast.error(messageFor(cause)))}
          disabled={loadingMore}
          className="mx-auto h-9 rounded-[8px] border border-black/8 bg-white px-5 text-[14px] font-semibold hover:bg-black/3 disabled:opacity-50"
        >
          {comments.length === 0 ? "Keep looking" : "Load more"}
        </button>
      )}
    </div>
  );
}

function MenuChip({
  label,
  active,
  options,
}: {
  label: string;
  active: boolean;
  options: { key: string; label: string; selected: boolean; pick: () => void }[];
}) {
  return (
    <Popover
      // As wide as the longest title, capped so a 150-character one cannot run off the screen.
      className="max-h-[320px] w-max max-w-[min(560px,calc(100vw-64px))] min-w-[260px] overflow-y-auto"
      trigger={({ open, toggle }) => <FilterChip label={label} active={active} open={open} onClick={toggle} />}
    >
      {(close) =>
        options.map((option) => (
          <MenuOption
            key={option.key}
            label={option.label}
            selected={option.selected}
            onClick={() => {
              option.pick();
              close();
            }}
          />
        ))
      }
    </Popover>
  );
}
