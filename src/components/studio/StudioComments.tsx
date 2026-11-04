"use client";

import { Search } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import { CommentRow } from "@/components/studio/CommentRow";
import { DateRangeChip, type DayRange } from "@/components/studio/DateRangeChip";
import { EmptyState, FilterChip, MenuOption, Popover, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { toast } from "@/components/ui/toast";
import { useCommentContext } from "@/hooks/use-comment-context";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { messageFor } from "@/lib/api/errors";
import { addComment, approveComment, deleteComment } from "@/lib/api/interactions";
import { listInboxComments, listStudioPosts } from "@/lib/api/studio";
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
export function StudioComments() {
  const [status, setStatus] = useState<StatusFilter>();
  const [videoId, setVideoId] = useState<string | undefined>();
  const [range, setRange] = useState<DayRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => {
    const id = window.setTimeout(() => setQ(search.trim()), 300);
    return () => window.clearTimeout(id);
  }, [search]);

  const [comments, setComments] = useState<CommentResponse[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = { status, videoId, q, ...dayRangeToInstants(range.start, range.end) };
  const queryKey = JSON.stringify(query);

  const load = useCallback(
    (after: string | null, signal?: AbortSignal) =>
      listInboxComments(JSON.parse(queryKey), after ?? undefined, 20, signal).then((page) => {
        setComments((current) => (after ? [...(current ?? []), ...page.items] : page.items));
        setCursor(page.nextCursor);
        setHasMore(page.hasMore);
        setError(null);
      }),
    [queryKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    load(null, controller.signal).catch((cause: unknown) => {
      if (!controller.signal.aborted) setError(messageFor(cause));
    });
    return () => controller.abort();
  }, [load]);

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
              <li key={comment.commentId}>
                <CommentRow
                  comment={comment}
                  author={authors.get(comment.userId)}
                  video={videos.get(comment.videoId)}
                  actions={<CommentActions comment={comment} onApproved={replace} onDeleted={drop} />}
                />
              </li>
            ))}
          </ul>
        )}
      </StudioCard>

      {hasMore && comments && (
        <button
          type="button"
          onClick={() => load(cursor).catch((cause: unknown) => toast.error(messageFor(cause)))}
          className="mx-auto h-9 rounded-[8px] border border-black/8 bg-white px-5 text-[14px] font-semibold hover:bg-black/3"
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
      className="max-h-[320px] w-[260px] overflow-y-auto"
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

function CommentActions({
  comment,
  onApproved,
  onDeleted,
}: {
  comment: CommentResponse;
  onApproved: (comment: CommentResponse) => void;
  onDeleted: (commentId: string) => void;
}) {
  const [replying, setReplying] = useState(false);
  const [reply, setReply] = useState("");
  const fail = (cause: unknown) => toast.error(messageFor(cause));
  const action = "font-semibold text-black/65 hover:text-black";

  return (
    <>
      {comment.status === "HELD" ? (
        <button
          type="button"
          className={action}
          onClick={() => approveComment(comment.videoId, comment.commentId).then(onApproved).catch(fail)}
        >
          Approve
        </button>
      ) : (
        <button type="button" className={action} onClick={() => setReplying((open) => !open)}>
          Reply
        </button>
      )}
      <button
        type="button"
        className={action}
        onClick={() =>
          deleteComment(comment.videoId, comment.commentId)
            .then(() => onDeleted(comment.commentId))
            .catch(fail)
        }
      >
        Delete
      </button>
      {replying && (
        <form
          className="flex flex-1 gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            addComment(comment.videoId, reply.trim(), comment.parentId ?? comment.commentId)
              .then(() => {
                setReply("");
                setReplying(false);
                toast.success("Reply posted");
              })
              .catch(fail);
          }}
        >
          <input
            autoFocus
            value={reply}
            onChange={(event) => setReply(event.target.value)}
            maxLength={150}
            placeholder="Add a reply…"
            className="h-8 min-w-0 flex-1 rounded-[4px] border border-black/12 px-2 text-[14px] text-black outline-none focus:border-black/34"
          />
          <button
            type="submit"
            disabled={!reply.trim()}
            className="h-8 rounded-[4px] bg-[#fe2c55] px-3 text-[13px] font-semibold text-white disabled:opacity-40"
          >
            Post
          </button>
        </form>
      )}
    </>
  );
}
