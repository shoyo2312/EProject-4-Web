"use client";

import {
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Forward,
  Heart,
  MessageCircle,
  Play,
  Search,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { DateRangeChip, type DayRange } from "@/components/studio/DateRangeChip";
import { PostThumb } from "@/components/studio/PostCell";
import { useOpenStudioVideo } from "@/components/studio/StudioVideoModal";
import { Checkbox, EmptyState, FilterChip, MenuOption, Popover, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { MODAL_EXIT_MS, Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useCommentContext } from "@/hooks/use-comment-context";
import { useDebounced } from "@/hooks/use-debounced";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useInboxComments } from "@/hooks/use-inbox-comments";
import { usePresence } from "@/hooks/use-presence";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { messageFor } from "@/lib/api/errors";
import { codePointLength, fitEdit } from "@/lib/code-points";
import {
  addComment,
  approveComment,
  deleteComment,
  getVideoCounts,
  likeComment,
  listReplies,
  unlikeComment,
} from "@/lib/api/interactions";
import { type InboxSort, listStudioPosts } from "@/lib/api/studio";
import type { CommentResponse, CountRange, VideoResponse } from "@/lib/api/types";
import { getVideo } from "@/lib/api/videos";
import { formatCount, formatDateTime, formatDuration, formatRelativeTime } from "@/lib/format";
import { dayRangeToInstants } from "@/lib/studio/metrics";
import { COUNT_RANGES } from "@/lib/studio/posts";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

/** TikTok's "All comments" chip, plus the held/published split this backend adds. */
const KIND_OPTIONS = [
  { key: "all", label: "All comments" },
  { key: "unanswered", label: "Unanswered", replied: false },
  { key: "answered", label: "Answered", replied: true },
  { key: "held", label: "Held for review", status: "HELD" },
  { key: "published", label: "Published", status: "VISIBLE" },
] as const;
type Kind = (typeof KIND_OPTIONS)[number]["key"];

const SORT_OPTIONS: { value: InboxSort; label: string }[] = [
  { value: "NEWEST", label: "Sort by newest comments" },
  { value: "MOST_LIKED", label: "Sort by most liked" },
  { value: "MOST_REPLIED", label: "Sort by most replies" },
];

/** How many replies one "View more replies" pulls down here — a wider panel than the feed's. */
const REPLY_PAGE = 20;

const CHIP = "flex h-9 items-center rounded-[8px] bg-black/5 px-4 text-[14px] leading-[18px] font-medium text-black";
const ACTION = "flex items-center gap-1 text-[13px] text-black/50 hover:text-black";

/**
 * `/studio/comment/{videoId}` — TikTok Studio's per-post comment page: the post
 * with its counters and a reply box on top, then search, filters and the
 * threads. Only top-level comments list here; a thread opens under its parent.
 */
export function StudioVideoComments({ videoId }: { videoId: string }) {
  const openVideo = useOpenStudioVideo();
  const video = useStudioQuery(`video:${videoId}`, (signal) => getVideo(videoId, signal));
  const counts = useStudioQuery(`counts:${videoId}`, (signal) =>
    getVideoCounts([videoId], signal).then((c) => c[0] ?? null),
  );

  const [kind, setKind] = useState<Kind>("all");
  const [sort, setSort] = useState<InboxSort>("NEWEST");
  const [followers, setFollowers] = useState<CountRange[]>([]);
  const [range, setRange] = useState<DayRange>({ start: null, end: null });
  const [search, setSearch] = useState("");
  const q = useDebounced(search.trim(), 300);
  const [choosing, setChoosing] = useState(false);

  const picked = KIND_OPTIONS.find((o) => o.key === kind)!;
  const queryKey = JSON.stringify({
    videoId,
    status: "status" in picked ? picked.status : undefined,
    replied: "replied" in picked ? picked.replied : undefined,
    sort: sort === "NEWEST" ? undefined : sort,
    followers,
    q,
    ...dayRangeToInstants(range.start, range.end),
  });

  // Replies live under their root and are read per thread; only a search lists them flat,
  // as its hits, so a match inside a thread is not lost.
  const { comments, setComments, hasMore, error, loadMore, loadingMore } = useInboxComments(queryKey, !q);

  const { authors } = useCommentContext(comments ?? []);
  const drop = (id: string) => setComments((current) => current?.filter((c) => c.commentId !== id) ?? null);
  const replace = (next: CommentResponse) =>
    setComments((current) => current?.map((c) => (c.commentId === next.commentId ? next : c)) ?? null);

  const v = video.data;
  const n = counts.data;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <Link href="/studio/comment" className="flex items-center gap-3 text-[20px] leading-6 font-bold hover:opacity-80">
          <ChevronLeft className="h-5 w-5" />
          Back to comments
        </Link>
        <button
          type="button"
          onClick={() => setChoosing(true)}
          className="h-9 rounded-[8px] bg-[#fe2c55] px-4 text-[14px] font-semibold text-white hover:bg-[#ea284e]"
        >
          Choose another post
        </button>
      </div>

      <StudioCard className="flex flex-col gap-5 p-8">
        <div className="flex gap-4">
          <button type="button" onClick={() => openVideo(videoId)} aria-label="Play video" className="relative flex-none">
            <PostThumb url={v?.thumbnailUrl ?? null} className="h-[220px] w-[148px] rounded-[8px] bg-black" />
            {v?.durationSeconds != null && (
              <span className="absolute right-0 bottom-2 left-0 text-center text-[12px] font-medium text-white">
                {formatDuration(v.durationSeconds)}
              </span>
            )}
          </button>
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            {v ? (
              <p className="truncate text-[16px] leading-6 font-bold">{v.title || v.description || "Untitled"}</p>
            ) : (
              <StudioSkeleton className="h-6 w-40" />
            )}
            <div className="flex items-center gap-4 text-[13px] font-semibold text-black/65">
              <Stat icon={Play} value={n?.viewCount ?? v?.viewCount} />
              <Stat icon={Heart} value={n?.likeCount ?? v?.likeCount} />
              <Stat icon={MessageCircle} value={n?.commentCount ?? v?.commentCount ?? undefined} />
              <Stat icon={Forward} value={n?.shareCount} />
              <Stat icon={Bookmark} value={n?.saveCount} />
            </div>
            {v && <p className="text-[13px] text-black/50">{formatRelativeTime(v.createdAt)}</p>}
            <ReplyBox
              className="mt-auto h-[88px] items-start py-3"
              placeholder="Reply to comments"
              counter
              onSubmit={(text) => addComment(videoId, text).then(() => { toast.success("Comment posted"); })}
            />
          </div>
        </div>

        <label className="flex h-10 w-[460px] max-w-full items-center gap-2 rounded-[8px] bg-black/5 px-3">
          <Search className="h-4 w-4 flex-none text-black/50" />
          <span className="h-4 border-l border-black/12" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search comments or usernames"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-black outline-none placeholder:text-black/34"
          />
        </label>

        <div className="flex flex-wrap items-center gap-4">
          <MenuChip
            label={SORT_OPTIONS.find((o) => o.value === sort)!.label}
            options={SORT_OPTIONS.map((o) => ({ key: o.value, label: o.label, selected: o.value === sort, pick: () => setSort(o.value) }))}
          />
          <MenuChip
            label={picked.label}
            options={KIND_OPTIONS.map((o) => ({ key: o.key, label: o.label, selected: o.key === kind, pick: () => setKind(o.key) }))}
          />
          <FollowerChip value={followers} onApply={setFollowers} />
          <DateRangeChip value={range} onApply={setRange} />
        </div>

        {error ? (
          <EmptyState>{error}</EmptyState>
        ) : !comments ? (
          <div className="flex flex-col gap-3">
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
                <Thread comment={comment} ownerId={v?.userId} authors={authors} onChanged={replace} onDeleted={drop} />
              </li>
            ))}
          </ul>
        )}

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
      </StudioCard>

      <ChoosePostDrawer open={choosing} current={videoId} onClose={() => setChoosing(false)} />
    </div>
  );
}

function MenuChip({
  label,
  options,
}: {
  label: string;
  options: { key: string; label: string; selected: boolean; pick: () => void }[];
}) {
  return (
    <Popover
      className="w-max min-w-[220px]"
      trigger={({ open, toggle }) => (
        <button type="button" onClick={toggle} aria-expanded={open} className={cn(CHIP, "gap-1")}>
          {label}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
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

/**
 * TikTok's "All follower counts" chip: tick any ranges, then Apply. ponytail: a copy of the
 * private CheckChip in StudioPosts.tsx; lift that one into ui.tsx when a third chip needs it.
 */
function FollowerChip({ value, onApply }: { value: CountRange[]; onApply: (value: CountRange[]) => void }) {
  const [draft, setDraft] = useState<CountRange[]>(value);
  const flip = (option: CountRange) =>
    setDraft((current) => (current.includes(option) ? current.filter((item) => item !== option) : [...current, option]));
  return (
    <Popover
      className="w-[217px] border border-black/8 py-0"
      trigger={({ open, toggle }) => (
        <FilterChip
          label={value.length ? `${value.length} follower ${value.length === 1 ? "range" : "ranges"}` : "All follower counts"}
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
            {COUNT_RANGES.map((option) => (
              <label
                key={option.value}
                className="flex h-8 cursor-pointer items-center gap-2 rounded-[4px] px-2.5 text-[14px] whitespace-nowrap hover:bg-black/4"
              >
                <Checkbox checked={draft.includes(option.value)} onChange={() => flip(option.value)} />
                {option.label}
              </label>
            ))}
          </div>
          <div className="flex justify-end border-t border-black/8 p-3">
            <button
              type="button"
              onClick={() => {
                onApply(draft);
                close();
              }}
              className="h-8 rounded-[6px] bg-[#fe2c55] px-4 text-[14px] font-medium text-white hover:bg-[#ea284e]"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}

function Stat({ icon: Icon, value }: { icon: typeof Play; value: number | undefined }) {
  return (
    <span className="flex items-center gap-1">
      <Icon className="h-4 w-4 fill-current text-black/34" strokeWidth={0} />
      {value === undefined ? "–" : formatCount(value)}
    </span>
  );
}

const COMMENT_MAX = 150;

function ReplyBox({
  placeholder,
  counter,
  autoFocus,
  className,
  onSubmit,
}: {
  placeholder: string;
  counter?: boolean;
  /** The inline box under a comment opens on a click, so the caret goes straight in. */
  autoFocus?: boolean;
  className?: string;
  onSubmit: (text: string) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <form
      className={cn("flex items-center gap-2 rounded-[8px] border border-black/12 px-3", className)}
      onSubmit={(event) => {
        event.preventDefault();
        if (busy || !text.trim()) return;
        setBusy(true);
        onSubmit(text.trim())
          .then(() => setText(""))
          .catch((cause: unknown) => toast.error(messageFor(cause)))
          .finally(() => setBusy(false));
      }}
    >
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <input
          autoFocus={autoFocus}
          value={text}
          // The server's 150 is in code points; maxLength would count an emoji twice.
          onChange={(event) => setText(fitEdit(text, event.target.value, COMMENT_MAX))}
          placeholder={placeholder}
          className="h-8 min-w-0 bg-transparent text-[14px] text-black outline-none placeholder:text-black/34"
        />
        {counter && (
          <span className="text-[12px] text-black/34">
            {codePointLength(text)}/{COMMENT_MAX}
          </span>
        )}
      </div>
      <button
        type="submit"
        disabled={busy || !text.trim()}
        className="h-8 flex-none rounded-[6px] bg-[#fe2c55] px-4 text-[14px] font-semibold text-white hover:bg-[#ea284e] disabled:cursor-not-allowed disabled:opacity-40"
      >
        Post
      </button>
    </form>
  );
}

function CommentBody({
  comment,
  author,
  replyTo,
  creator,
  children,
}: {
  comment: CommentResponse;
  author: Author | undefined;
  /** Whom a reply to a reply answers — TikTok's "A ▸ B". */
  replyTo?: Author;
  creator: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3">
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar host is whatever user-service allowed */}
      <img
        src={author?.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-10 w-10 flex-none rounded-full bg-black/8 object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex min-w-0 items-center gap-1.5 text-[14px] leading-[18px]">
          <Link href={author ? `/@${author.username}` : "#"} className="truncate font-semibold text-black/65 hover:underline">
            {author?.nickname ?? "…"}
          </Link>
          {replyTo && (
            <span aria-label={`Replying to ${replyTo.nickname}`} className="flex min-w-0 items-center gap-1 text-black/65">
              <ChevronRight className="h-3.5 w-3.5 flex-none" aria-hidden />
              <span className="truncate font-semibold">{replyTo.nickname}</span>
            </span>
          )}
          {creator && (
            // TikTok's "Creator" pill: cyan on a cyan wash.
            <span className="flex-none rounded-[2px] bg-[#00a2c9]/12 px-[3px] text-[10px] leading-[15px] font-medium text-[#009eb2]">
              Creator
            </span>
          )}
          {comment.status === "HELD" && (
            <span className="rounded-[4px] bg-[#ffb800]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#8a6100]">
              Held for review
            </span>
          )}
        </div>
        <p className="text-[14px] leading-5 break-words whitespace-pre-wrap text-black">{comment.content}</p>
        {children}
      </div>
    </div>
  );
}

/** Delete, asked first: it is one way, and usually someone else's words. */
function DeleteButton({ comment, onDeleted }: { comment: CommentResponse; onDeleted: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const sheet = usePresence(confirming, MODAL_EXIT_MS);
  const [busy, setBusy] = useState(false);
  const remove = () => {
    setBusy(true);
    deleteComment(comment.videoId, comment.commentId)
      .then(() => {
        setConfirming(false);
        // After the sheet has shrunk away: dropping the comment unmounts this button, and the sheet with it.
        window.setTimeout(onDeleted, MODAL_EXIT_MS);
      })
      .catch((cause: unknown) => toast.error(messageFor(cause)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <button type="button" aria-label="Delete comment" className={ACTION} onClick={() => setConfirming(true)}>
        <Trash2 className="h-4 w-4" /> Delete
      </button>
      {sheet.mounted && (
        <Modal
          closing={sheet.closing}
          onClose={() => !busy && setConfirming(false)}
          className="w-[400px] rounded-[8px] bg-white p-6 text-center text-black"
        >
          <p className="text-[20px] font-bold">Delete this comment?</p>
          <p className="mt-2 text-[14px] text-black/65">It is removed from your post for everyone.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => setConfirming(false)}
              className="h-10 flex-1 rounded-[4px] border border-black/12 font-semibold hover:bg-black/3"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={remove}
              className="h-10 flex-1 rounded-[4px] bg-[#fe2c55] font-semibold text-white hover:bg-[#ea284e] disabled:opacity-60"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}

/**
 * One comment and the replies under it. Also a row of the Studio inbox, where the comment may itself
 * be a reply: its thread lives under its root, so a reply posted from that row is only shown here.
 */
export function Thread({
  comment,
  ownerId,
  authors,
  onChanged,
  onDeleted,
}: {
  comment: CommentResponse;
  ownerId: string | undefined;
  authors: Map<string, Author>;
  onChanged: (comment: CommentResponse) => void;
  onDeleted: (id: string) => void;
}) {
  const isRoot = comment.parentId === null;
  /** Which comment the reply box answers: this one, or one of the replies under it. */
  const [replyingTo, setReplyingTo] = useState<CommentResponse | null>(null);
  const [replies, setReplies] = useState<CommentResponse[] | null>(isRoot ? null : []);
  const [replyCursor, setReplyCursor] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const { authors: replyAuthors } = useCommentContext(replies ?? []);
  const who = (id: string | null) => (id ? (replyAuthors.get(id) ?? authors.get(id)) : undefined);
  const count = isRoot ? comment.replyCount : (replies?.length ?? 0);
  const fail = (cause: unknown) => toast.error(messageFor(cause));

  const loadReplies = (after: string | null) =>
    listReplies(comment.videoId, comment.commentId, after ?? undefined, REPLY_PAGE)
      .then((page) => {
        setReplies((current) => (after ? [...(current ?? []), ...page.items] : page.items));
        setReplyCursor(page.hasMore ? page.nextCursor : null);
      })
      .catch(fail);
  const showReplies = () => {
    setOpen(true);
    if (replies === null) loadReplies(null);
  };
  // TikTok threads one level deep. Answering a reply sends that reply's id: interaction-service files
  // it under the root and records whom it answers, which is what draws "A ▸ B".
  const reply = (target: CommentResponse) => (text: string) =>
    addComment(comment.videoId, text, target.commentId).then((posted) => {
      setReplyingTo(null);
      // A thread not fetched yet is fetched whole — the new reply with it — rather than started from it.
      if (replies === null) showReplies();
      else setReplies([...replies, posted]);
      setOpen(true);
      if (isRoot) onChanged({ ...comment, replyCount: comment.replyCount + 1 });
    });
  const dropReply = (id: string) => {
    setReplies((current) => current?.filter((x) => x.commentId !== id) ?? null);
    if (isRoot) onChanged({ ...comment, replyCount: Math.max(0, comment.replyCount - 1) });
  };
  const box = (target: CommentResponse) =>
    replyingTo?.commentId === target.commentId && (
      <ReplyBox
        className="mt-2 h-11 w-[680px] max-w-full"
        autoFocus
        placeholder={`Reply to ${who(target.userId)?.nickname ?? "comment"}`}
        onSubmit={reply(target)}
      />
    );
  const replyButton = (target: CommentResponse) => (
    <button
      type="button"
      className={cn(ACTION, "font-semibold text-[#fe2c55]")}
      onClick={() => setReplyingTo((current) => (current?.commentId === target.commentId ? null : target))}
    >
      <MessageCircle className="h-4 w-4" /> Reply
    </button>
  );

  return (
    <div className="flex flex-col gap-3 rounded-[8px] px-2 py-4 hover:bg-black/3">
      <CommentBody
        comment={comment}
        author={authors.get(comment.userId)}
        replyTo={who(comment.replyToUserId)}
        creator={comment.userId === ownerId}
      >
        <div className="mt-2 flex items-center gap-4">
          <span className="text-[13px] text-black/50">{formatRelativeTime(comment.createdAt)}</span>
          {comment.status === "HELD" ? (
            <button
              type="button"
              className={cn(ACTION, "font-semibold text-[#fe2c55]")}
              onClick={() => approveComment(comment.videoId, comment.commentId).then(onChanged).catch(fail)}
            >
              Approve
            </button>
          ) : (
            replyButton(comment)
          )}
          {count > 0 && (
            <button type="button" className={ACTION} onClick={open ? () => setOpen(false) : showReplies}>
              {open ? "Hide replies" : `View ${count} ${count === 1 ? "reply" : "replies"}`}
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>
          )}
          <span className="h-3 border-l border-black/12" />
          <LikeButton comment={comment} onChanged={onChanged} />
          <DeleteButton comment={comment} onDeleted={() => onDeleted(comment.commentId)} />
        </div>
        {box(comment)}
        {open && (
          <div className="mt-3 flex flex-col gap-4">
            {replies === null ? (
              <StudioSkeleton className="h-10" />
            ) : (
              replies.map((r) => (
                <CommentBody
                  key={r.commentId}
                  comment={r}
                  author={who(r.userId)}
                  replyTo={who(r.replyToUserId)}
                  creator={r.userId === ownerId}
                >
                  <div className="mt-2 flex items-center gap-4">
                    <span className="text-[13px] text-black/50">{formatRelativeTime(r.createdAt)}</span>
                    {replyButton(r)}
                    <LikeButton
                      comment={r}
                      onChanged={(next) =>
                        setReplies((c) => c?.map((x) => (x.commentId === next.commentId ? next : x)) ?? null)
                      }
                    />
                    <DeleteButton comment={r} onDeleted={() => dropReply(r.commentId)} />
                  </div>
                  {box(r)}
                </CommentBody>
              ))
            )}
            <div className="flex items-center gap-4">
              {replyCursor && (
                <button type="button" className={cn(ACTION, "font-semibold")} onClick={() => loadReplies(replyCursor)}>
                  View more replies <ChevronDown className="h-4 w-4" />
                </button>
              )}
              <button type="button" className={ACTION} onClick={() => setOpen(false)}>
                Hide <ChevronUp className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </CommentBody>
    </div>
  );
}

function LikeButton({ comment, onChanged }: { comment: CommentResponse; onChanged: (comment: CommentResponse) => void }) {
  const toggle = comment.likedByMe ? unlikeComment : likeComment;
  return (
    <button
      type="button"
      className={cn(ACTION, comment.likedByMe && "text-[#fe2c55]")}
      onClick={() =>
        toggle(comment.videoId, comment.commentId)
          .then((r) => onChanged({ ...comment, likedByMe: r.liked, likeCount: r.likeCount }))
          .catch((cause: unknown) => toast.error(messageFor(cause)))
      }
    >
      <Heart className={cn("h-4 w-4", comment.likedByMe && "fill-current")} /> {comment.likeCount}
    </button>
  );
}

/**
 * TikTok's right-hand sheet: every post with its counters, the current one included.
 * Stays mounted so the 500ms slide can run both ways, as the Popover in `ui.tsx` does;
 * the list itself is only fetched once the sheet has been opened.
 */
function ChoosePostDrawer({ open, current, onClose }: { open: boolean; current: string; onClose: () => void }) {
  useEscapeKey(onClose, open);
  const [opened, setOpened] = useState(open);
  if (open && !opened) setOpened(true);
  const posts = useStudioQuery(opened ? "choose-post" : "", (signal) =>
    opened ? listStudioPosts({ size: 50 }, signal) : Promise.resolve(null),
  );
  const motion = "duration-500 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none";
  return (
    <div
      aria-hidden={!open}
      onClick={onClose}
      className={cn(
        "fixed inset-0 z-40 flex justify-end bg-black/30 transition-[opacity,display] transition-discrete",
        motion,
        open ? "flex opacity-100 starting:opacity-0" : "hidden opacity-0",
      )}
    >
      <aside
        role="dialog"
        aria-label="Choose another post"
        onClick={(event) => event.stopPropagation()}
        className={cn(
          "flex h-full w-[640px] max-w-full flex-col bg-white shadow-[0_0_24px_rgba(0,0,0,0.16)] transition-transform",
          motion,
          open ? "translate-x-0 starting:translate-x-full" : "translate-x-full",
        )}
      >
        <div className="flex h-[68px] flex-none items-center gap-3 px-6">
          <button type="button" onClick={onClose} aria-label="Close" className="rounded p-1 hover:bg-black/5">
            <X className="h-5 w-5" />
          </button>
          <span className="text-[18px] font-bold">Choose another post</span>
        </div>
        <ul className="min-h-0 flex-1 divide-y divide-black/8 overflow-y-auto">
          {(posts.data?.content ?? []).map((post: VideoResponse) => (
            <li key={post.id}>
              <Link
                href={`/studio/comment/${post.id}`}
                onClick={onClose}
                aria-current={post.id === current ? "page" : undefined}
                className="flex gap-4 px-6 py-4 hover:bg-black/3 aria-[current]:bg-black/5"
              >
                <PostThumb url={post.thumbnailUrl} className="h-[116px] w-[88px] rounded-[6px] bg-black" />
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <p className="truncate text-[16px] font-bold">{post.title || post.description || "Untitled"}</p>
                  <div className="flex items-center gap-4 text-[13px] font-semibold text-black/65">
                    <Stat icon={Play} value={post.viewCount} />
                    <Stat icon={Heart} value={post.likeCount} />
                    <Stat icon={MessageCircle} value={post.commentCount ?? undefined} />
                  </div>
                  <p className="mt-auto text-[12px] text-black/50">Posted: {formatDateTime(new Date(post.createdAt))}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </aside>
    </div>
  );
}
