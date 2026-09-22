"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionRail } from "@/components/feed/ActionRail";
import { CommentPanel } from "@/components/feed/CommentPanel";
import { VideoCard } from "@/components/feed/VideoCard";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useLikeDebounce } from "@/hooks/use-like-debounce";
import { useVideoRealtime, withLikeCount, type VideoFrame } from "@/hooks/use-video-realtime";
import { isBackendHandle } from "@/lib/api/adapters";
import { useSavedVideos } from "@/hooks/use-saved-videos";
import { getLikeStatuses, likeVideo, unlikeVideo } from "@/lib/api/interactions";
import { getAccessToken } from "@/lib/api/tokens";
import { getVideo } from "@/lib/api/videos";
import { loadFirstCommentPage } from "@/lib/comment-cache";
import { cn } from "@/lib/utils";
import type { Comment, FeedVideo } from "@/types/tiktok";

/** Matches the wrapper's `transition-duration: 300ms` on the live site. */
const SIDEBAR_TRANSITION_MS = 300;

/**
 * `.DivColumnListContainer` — the scroll-snap container.
 *
 * INTERACTION MODEL: **scroll-driven**, native CSS scroll-snap. Confirmed on the
 * live site:
 *   container: overflow-y: scroll; scroll-snap-type: y mandatory; padding-right: 56px
 *   article:   scroll-snap-align: start center; scroll-snap-stop: always
 *
 * `scroll-snap-stop: always` is what makes the feed advance exactly one video per
 * gesture. The up/down arrows are a secondary affordance that programmatically
 * scrolls by one item — they are NOT the primary mechanism, so this is not a
 * click-driven carousel.
 *
 * The comment sidebar is a **flex sibling** of the list inside `DivMainContainer`
 * (`display: flex; flex-direction: row`), not an overlay. Opening it narrows the
 * feed column by exactly the sidebar's width — verified live: article 1616px →
 * 1232px, a 384px delta against a 384px panel.
 */
export function Feed({
  videos,
  comments,
  onReachEnd,
}: {
  videos: FeedVideo[];
  /** Comments keyed by video id — the panel reads its own list out of this. */
  comments: Record<string, Comment[]>;
  /**
   * Fired when the viewer is within a couple of cards of the end, so a paged
   * feed can fetch the next page. Absent for a fixed list.
   */
  onReachEnd?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  /** Set from the card's right-click menu; see `PlayerSettingsProvider`. */
  const { autoScroll } = usePlayerSettings();

  /**
   * Like state is lifted here because two things drive it: the action rail's
   * heart button (toggles) and double-tapping the video (likes only, never
   * un-likes).
   */
  const [likedIds, setLikedIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * Bookmarks. Unlike the hearts above this is one request for the whole set
   * rather than one per card — see `useSavedVideos`.
   */
  const { isSaved, toggleSave } = useSavedVideos();

  /**
   * Server-known like counts, by video id, overriding the count the feed was
   * rendered with. Needed because `stats.likes` already counts the viewer's own
   * like: the heart cannot add one on top without showing 2 for a single like.
   */
  const [likeCounts, setLikeCounts] = useState<Record<string, number>>({});

  // Liking needs an account: signed out, the live site swallows the tap and
  // opens the login modal instead. Both entry points funnel through here, so
  // the gate only has to exist once.
  const { user, requireSignIn } = useSession();

  // Seed hearts for videos the viewer already liked in a previous session.
  // Backend videos only — mock ids have no like-status endpoint to ask.
  useEffect(() => {
    if (!user) return;
    const backendIds = videos.filter((v) => isBackendHandle(v.id)).map((v) => v.id);
    if (backendIds.length === 0) return;
    let cancelled = false;

    getLikeStatuses(backendIds).then((statuses) => {
      if (cancelled) return;
      setLikedIds((current) => {
        const next = new Set(current);
        statuses.forEach((status) => {
          if (status.liked) next.add(status.videoId);
        });
        return next;
      });
      setLikeCounts((current) => {
        const next = { ...current };
        statuses.forEach((status) => {
          next[status.videoId] = status.likeCount;
        });
        return next;
      });
    }).catch(() => {
      // No session, or the call failed — hearts just start unfilled.
    });

    return () => {
      cancelled = true;
    };
  }, [videos, user]);

  /**
   * Snapshot of the latest `counts` realtime frame per video id — a video not
   * present here just shows the count the feed already knows. `state` frames
   * (status/visibility changed) don't carry counts; they drive `hiddenIds`
   * below instead.
   */
  const [liveFrames, setLiveFrames] = useState<Record<string, VideoFrame>>({});

  /**
   * A `state` frame said this video's status/visibility may no longer pass
   * the whitelist every read path applies (see CLAUDE.md §Kiểm duyệt video tự
   * động) — set from a refetch through the same API client every other read
   * uses, never from the frame's own fields, which are a hint and not the
   * truth.
   */
  const [hiddenIds, setHiddenIds] = useState<ReadonlySet<string>>(new Set());

  /**
   * Confirmed once a per-video `useLikeDebounce` (see `FeedVideoCard` below)
   * gets a real response back — `likedIds` is that hook's `serverLiked`, and
   * has to move in lockstep with `likeCounts` or the offset each card
   * computes (`liked !== serverLiked ? ±1 : 0`) double-counts against a
   * `likeCounts` entry that already includes the change.
   */
  const onLikeConfirmed = useCallback((id: string, liked: boolean, likeCount: number) => {
    setLikeCounts((current) => ({ ...current, [id]: likeCount }));
    // The last counts frame was read before this like landed, and the card
    // prefers the frame over `likeCounts` — see `withLikeCount`. Left alone it
    // pulls the count back to its pre-like value for the ~150ms until the next
    // frame arrives, which is the flicker this corrects.
    setLiveFrames((current) => withLikeCount(current, id, likeCount));
    setLikedIds((current) => {
      if (current.has(id) === liked) return current;
      const next = new Set(current);
      if (liked) next.add(id);
      else next.delete(id);
      return next;
    });
  }, []);

  const handleRealtimeFrame = useCallback((frame: VideoFrame) => {
    if (frame.type === "counts") {
      setLiveFrames((current) => ({ ...current, [frame.videoId]: frame }));
      return;
    }
    getVideo(frame.videoId)
      .then((video) => {
        const visible = video.status === "PUBLISHED" && video.visibility === "PUBLIC";
        setHiddenIds((current) => {
          if (current.has(frame.videoId) === !visible) return current;
          const next = new Set(current);
          if (visible) next.delete(frame.videoId);
          else next.add(frame.videoId);
          return next;
        });
      })
      .catch(() => {
        // Transient — leave visibility as it was until the next frame.
      });
  }, []);

  // The realtime scope is the whole rendered feed, not just the playing card.
  const backendVideoIds = useMemo(
    () => videos.filter((video) => isBackendHandle(video.id)).map((video) => video.id),
    [videos],
  );
  const wsToken = user ? getAccessToken() : null;
  useVideoRealtime(backendVideoIds, wsToken, handleRealtimeFrame);

  const visibleVideos = useMemo(
    () => videos.filter((video) => !hiddenIds.has(video.id)),
    [videos, hiddenIds],
  );

  /**
   * Comments posted in this session, per video id. Lifted here so the action
   * rail's count and the panel header stay in agreement.
   */
  const [extraComments, setExtraComments] = useState<Record<string, number>>({});

  const countComment = useCallback((id: string) => {
    setExtraComments((current) => ({ ...current, [id]: (current[id] ?? 0) + 1 }));
  }, []);

  const uncountComment = useCallback((id: string) => {
    setExtraComments((current) => ({ ...current, [id]: (current[id] ?? 0) - 1 }));
  }, []);

  /**
   * The panel stays mounted through its collapse so the content does not pop
   * out mid-transition — the wrapper's `overflow: hidden` clips it, which is
   * what the live site does (it only flips to `overflow: visible` on
   * `...-enter-done`).
   */
  const [commentVideo, setCommentVideo] = useState<FeedVideo | null>(null);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const unmountTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
    };
  }, []);

  /**
   * `.comments-open` on <html> drives `--comment-sidebar-width` (globals.css)
   * and lets TopBar unmount itself — both sit outside this component tree.
   * Writing a class on the root is a sync to an external system, not derived
   * render state.
   */
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("comments-open", commentsOpen);
    return () => root.classList.remove("comments-open");
  }, [commentsOpen]);

  const closeComments = useCallback(() => {
    setCommentsOpen(false);
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    unmountTimer.current = setTimeout(
      () => setCommentVideo(null),
      SIDEBAR_TRANSITION_MS,
    );
  }, []);

  /**
   * The sidebar follows the feed. Scrolling to the next video while comments are
   * open has to swap the panel to that video's thread — before this, the panel
   * kept showing the thread of whichever video the button was pressed on, which
   * reads as "this video has those comments".
   *
   * Driven by the card that owns the viewport, the same signal that starts
   * playback, so the panel cannot end up on a video that is not the one playing.
   * `commentsOpen` is read through a ref: this runs on every snap, and a
   * dependency on it would re-create the callback and re-render every card in
   * the list each time the sidebar toggles.
   */
  const commentsOpenRef = useRef(commentsOpen);
  useEffect(() => {
    commentsOpenRef.current = commentsOpen;
  }, [commentsOpen]);

  /**
   * Which card owns the viewport. Only the media window reads it: the card on
   * screen and the one below it fetch video, everything else waits — see
   * `useHlsSource`. Reported by the cards themselves, because the observer that
   * decides which one is playing is the only thing that knows.
   */
  const [activeIndex, setActiveIndex] = useState(0);

  const followActiveVideo = useCallback((video: FeedVideo) => {
    if (!commentsOpenRef.current) return;
    if (unmountTimer.current) clearTimeout(unmountTimer.current);
    setCommentVideo((current) => (current?.id === video.id ? current : video));
  }, []);

  const toggleComments = useCallback(
    (video: FeedVideo) => {
      if (commentsOpen && commentVideo?.id === video.id) {
        closeComments();
        return;
      }
      if (unmountTimer.current) clearTimeout(unmountTimer.current);
      setCommentVideo(video);
      setCommentsOpen(true);
    },
    [commentsOpen, commentVideo, closeComments],
  );

  /**
   * Paging trigger. Watches the snap container rather than an observer on a
   * sentinel element, because the container is the only thing that scrolls and
   * its own metrics answer the question directly. Two screens of lead time
   * keeps the next page in place before the viewer reaches it.
   */
  useEffect(() => {
    const list = listRef.current;
    if (!list || !onReachEnd) return;

    const onScroll = () => {
      const remaining = list.scrollHeight - list.scrollTop - list.clientHeight;
      if (remaining < list.clientHeight * 2) onReachEnd();
    };

    list.addEventListener("scroll", onScroll, { passive: true });
    return () => list.removeEventListener("scroll", onScroll);
  }, [onReachEnd]);

  /**
   * With the panel open, warm the next card's comments while the viewer is
   * still on this one. The fetch is the same cached one the panel makes on
   * mount, so scrolling down finds the page already there and paints without
   * a skeleton; nothing is fetched while the panel is shut.
   */
  useEffect(() => {
    if (!commentsOpen) return;
    const next = visibleVideos[activeIndex + 1];
    if (!next || !isBackendHandle(next.id) || next.commentsDisabled) return;
    loadFirstCommentPage(next.id).catch(() => {
      // A prefetch that fails changes nothing: the panel retries on open.
    });
  }, [commentsOpen, activeIndex, visibleVideos]);

  const scrollByItem = useCallback((direction: 1 | -1) => {
    const list = listRef.current;
    if (!list) return;
    const item = list.querySelector("article");
    if (!item) return;
    list.scrollBy({ top: item.clientHeight * direction, behavior: "smooth" });
  }, []);

  return (
    <main className="flex flex-1 flex-row">
      <div className="relative flex-1 overflow-hidden">
        <div
          ref={listRef}
          // `padding-right: 64px`, constant in both states — the gutter is NOT
          // dropped when the sidebar opens. Verified by arithmetic on the live
          // site: 1920 − 64 − 240 = 1616 closed, 1536 − 64 − 240 = 1232 open,
          // both matching the measured article widths exactly.
          className="no-scrollbar relative h-screen w-full snap-y snap-mandatory overflow-y-scroll pr-16 tt-1024:pr-0"
        >
          {visibleVideos.map((video, index) => (
            <FeedVideoCard
              key={video.id}
              video={video}
              index={index}
              activeIndex={activeIndex}
              commentsOpen={commentsOpen && commentVideo?.id === video.id}
              commentCount={video.stats.comments + (extraComments[video.id] ?? 0)}
              liveFrame={liveFrames[video.id]}
              baseLikeCount={likeCounts[video.id] ?? video.stats.likes}
              serverLiked={likedIds.has(video.id)}
              requireSignIn={requireSignIn}
              onLikeConfirmed={onLikeConfirmed}
              onActive={() => {
                setActiveIndex(index);
                followActiveVideo(video);
              }}
              onEnded={autoScroll ? () => scrollByItem(1) : undefined}
              onCommentClick={() => toggleComments(video)}
              saved={isSaved(video.id)}
              onToggleSave={() => toggleSave(video.id)}
            />
          ))}
        </div>

        <FeedNavArrows onUp={() => scrollByItem(-1)} onDown={() => scrollByItem(1)} />
      </div>

      {/*
       * `.DivCommentSidebarTransitionWrapper` — overflow hidden, z-index 8,
       * `transition-property: flex, width` over 300ms **linear**. Widths are
       * 24rem, 21rem (<=1280) and 18rem (<=1024).
       */}
      <aside
        className={cn(
          "z-[8] h-screen flex-none overflow-hidden",
          "w-[var(--comment-sidebar-width)]",
          "transition-[width] duration-300 ease-linear",
        )}
      >
        {commentVideo && (
          // Keyed so switching videos starts the panel from that video's own
          // comment list instead of carrying the previous one's state over.
          <CommentPanel
            key={commentVideo.id}
            videoId={commentVideo.id}
            videoOwnerId={commentVideo.author.userId}
            comments={comments[commentVideo.id] ?? []}
            commentsDisabled={commentVideo.commentsDisabled}
            commentCount={
              // Same source of truth as the card: the counts frame is
              // authoritative, the local delta only covers the gap before the
              // first frame lands. Adding the delta on top of the frame
              // double-counted the poster's own comment.
              liveFrames[commentVideo.id]?.commentCount ??
              commentVideo.stats.comments + (extraComments[commentVideo.id] ?? 0)
            }
            onClose={closeComments}
            onCommentAdded={() => countComment(commentVideo.id)}
            onCommentDeleted={() => uncountComment(commentVideo.id)}
          />
        )}
      </aside>
    </main>
  );
}

/**
 * One card + its action rail. Pulled out of `Feed`'s `.map` because the like
 * state now lives behind `useLikeDebounce` — a hook, which cannot be called a
 * variable number of times inside a loop in the parent's own render. Each
 * mounted instance owns exactly one `useLikeDebounce` call, so the feed's
 * length can change across renders without breaking the rules of hooks.
 */
function FeedVideoCard({
  video,
  index,
  activeIndex,
  commentsOpen,
  commentCount,
  liveFrame,
  baseLikeCount,
  serverLiked,
  requireSignIn,
  onLikeConfirmed,
  onActive,
  onEnded,
  onCommentClick,
  saved,
  onToggleSave,
}: {
  video: FeedVideo;
  index: number;
  activeIndex: number;
  /** True when this video's comment sidebar is the one currently open. */
  commentsOpen: boolean;
  /** Mock count plus anything the viewer posted this session or the server broadcast. */
  commentCount: number;
  /** Latest `counts` realtime frame for this video, if one has arrived. */
  liveFrame?: VideoFrame;
  /** Server-confirmed like count, before this card's own pending toggle. */
  baseLikeCount: number;
  /** Server-confirmed liked state — `useLikeDebounce`'s `serverLiked`. */
  serverLiked: boolean;
  requireSignIn: () => boolean;
  onLikeConfirmed: (id: string, liked: boolean, likeCount: number) => void;
  onActive: () => void;
  onEnded?: () => void;
  onCommentClick: () => void;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const send = useCallback(
    async (liked: boolean) => {
      if (!isBackendHandle(video.id)) return;
      const status = liked ? await likeVideo(video.id) : await unlikeVideo(video.id);
      // The reply carries the true state and count — the debounced tap only
      // guessed, and is stale the moment anyone else likes the same video.
      onLikeConfirmed(video.id, status.liked, status.likeCount);
    },
    [video.id, onLikeConfirmed],
  );

  const { liked, toggle } = useLikeDebounce(serverLiked, send);

  const toggleLike = useCallback(() => {
    if (!requireSignIn()) return;
    toggle();
  }, [requireSignIn, toggle]);

  const likeOnly = useCallback(() => {
    if (!requireSignIn()) return;
    if (!liked) toggle();
  }, [requireSignIn, liked, toggle]);

  const likesBase = liveFrame?.likeCount ?? baseLikeCount;
  const displayLikes = liked === serverLiked ? likesBase : likesBase + (liked ? 1 : -1);
  const displayComments = liveFrame?.commentCount ?? commentCount;

  return (
    <article
      className={cn(
        // Live site uses the two-axis value `start center` (block/inline).
        "relative flex snap-always items-center justify-center gap-4 overflow-hidden py-4",
        "[scroll-snap-align:start_center]",
        "[min-height:calc(100vh-var(--one-column-top-content-height)-var(--one-column-item-bottom-content-height))]",
        "mx-auto transition-[margin,height,width,padding] duration-300 ease-[var(--tt-ease)]",
        commentsOpen
          ? // With the sidebar open the live site swaps in an emotion class
            // whose only padding declaration is `padding-inline: 1rem` — all
            // four breakpoint branches below collapse into it.
            "[padding-inline:1rem]"
          : [
              // >1280 — mirrors the base rule on the live site
              "[padding-inline-start:calc(var(--feed-nav-button-width)+1rem)]",
              "[padding-inline-end:calc(15rem-var(--feed-nav-button-width)-1rem)]",
              // <=1280
              "tt-1280:[padding-inline-start:1rem]",
              "tt-1280:[padding-inline-end:calc(15rem-(var(--feed-nav-button-width)*2)-1rem)]",
              // <=1024
              "tt-1024:[padding-inline-start:var(--feed-nav-button-width)]",
              "tt-1024:[padding-inline-end:1rem]",
              // <=768
              "tt-768:[padding-inline:1rem]",
            ].join(" "),
      )}
    >
      {/*
       * `.DivContentFlexLayout` — full article content width, centred,
       * 16px gap; the card grows into it and its own max-width decides
       * where it stops. Cross-axis alignment is the one thing that
       * differs by orientation, measured live at 1920×936:
       *   portrait  align-items: end     rail bottom-aligned  (y 1476)
       *   landscape align-items: center  rail centred         (y 252)
       */}
      <div
        className={cn(
          // `min-w-0`: without it this row's automatic minimum is the
          // card's min-content, which the feed column cannot shrink
          // past — that is what put a horizontal scrollbar on the page
          // between 1025px and 1083px with the comment sidebar open.
          "flex w-full min-w-0 flex-1 justify-center gap-4",
          video.width > video.height ? "items-center" : "items-end",
        )}
      >
        <VideoCard
          video={video}
          distance={index - activeIndex}
          onLike={likeOnly}
          onActive={onActive}
          // The feed's counterpart to auto scroll on `/video/[id]`:
          // there, finishing a clip navigates to the next video; here
          // it scrolls the snap container on by one card. Passing this
          // also turns `loop` off, which is what lets `ended` fire.
          onEnded={onEnded}
        />
        <ActionRail
          video={video}
          commentCount={displayComments}
          commentsOpen={commentsOpen}
          onCommentClick={onCommentClick}
          liked={liked}
          likes={displayLikes}
          onToggleLike={toggleLike}
          saved={saved}
          saveCount={liveFrame?.saveCount}
          onToggleSave={onToggleSave}
        />
      </div>
    </article>
  );
}

/**
 * `[data-e2e="feed-navigation-prev"|"feed-navigation-next"]` — 48×48, sitting
 * 16px from the feed column's right edge with a 16px gap. They live inside the
 * column, so opening the comment sidebar shifts them by exactly the panel width
 * (measured live: x 1856 → 1472, a 384px delta).
 */
function FeedNavArrows({
  onUp,
  onDown,
}: {
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-4 tt-1024:hidden">
      <ArrowButton onClick={onUp} label="Previous video" direction="up" />
      <ArrowButton onClick={onDown} label="Next video" direction="down" />
    </div>
  );
}

function ArrowButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "up" | "down";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
    >
      <svg
        viewBox="0 0 48 48"
        className={`h-6 w-6 ${direction === "down" ? "rotate-180" : ""}`}
        fill="currentColor"
      >
        <path d="M24 15.4 8.7 30.7a1 1 0 0 0 0 1.4l1.4 1.4a1 1 0 0 0 1.4 0L24 20.9l12.5 12.6a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4L24 15.4Z" />
      </svg>
    </button>
  );
}
