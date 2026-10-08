"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommentPanel } from "@/components/feed/CommentPanel";
import { FeedNavArrows } from "@/components/feed/list/FeedNavArrows";
import { FeedVideoCard } from "@/components/feed/list/FeedVideoCard";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { useLikeStatuses } from "@/hooks/use-like-statuses";
import { useVideoRealtime, type VideoFrame } from "@/hooks/use-video-realtime";
import { isBackendVideoId } from "@/lib/api/adapters";
import { isApiError } from "@/lib/api/errors";
import { useSavedVideos } from "@/hooks/use-saved-videos";
import { getVideo } from "@/lib/api/videos";
import { loadFirstCommentPage } from "@/lib/comment-cache";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/types/tiktok";

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
  onReachEnd,
}: {
  videos: FeedVideo[];
  /**
   * Fired when the viewer is within a couple of cards of the end, so a paged
   * feed can fetch the next page. Absent for a fixed list.
   */
  onReachEnd?: () => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);

  /** Set from the card's right-click menu; see `PlayerSettingsProvider`. */
  const { autoScroll } = usePlayerSettings();

  const { user } = useSession();

  // The scope of the hearts' batch and of the realtime subscriptions: the whole
  // rendered feed, not just the playing card. Mock videos have neither.
  const backendVideoIds = useMemo(
    () => videos.filter((video) => isBackendVideoId(video.id)).map((video) => video.id),
    [videos],
  );

  /**
   * The server's side of every heart, lifted here so one batch request seeds
   * the whole list. Each card's own taps — the rail's heart and a double tap
   * on the video — go through that card's `useVideoLike`.
   */
  const likes = useLikeStatuses(backendVideoIds, user?.userId);
  const { syncCount: syncLikeCount } = likes;

  /**
   * Bookmarks — the viewer's whole saved set, fetched once and shared by every
   * card; see `useSavedVideos`.
   */
  const { isSaved, toggleSave } = useSavedVideos();

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

  const handleRealtimeFrame = useCallback((frame: VideoFrame) => {
    if (frame.type === "counts") {
      setLiveFrames((current) => ({ ...current, [frame.videoId]: frame }));
      // The heart reads its count from the ledger, where a like reply newer
      // than this frame can still correct it.
      if (frame.likeCount !== undefined) syncLikeCount(frame.videoId, frame.likeCount);
      return;
    }
    const setVisible = (visible: boolean) =>
      setHiddenIds((current) => {
        if (current.has(frame.videoId) === !visible) return current;
        const next = new Set(current);
        if (visible) next.delete(frame.videoId);
        else next.add(frame.videoId);
        return next;
      });

    getVideo(frame.videoId)
      .then((video) => {
        setVisible(video.status === "PUBLISHED" && video.visibility === "PUBLIC");
      })
      .catch((cause: unknown) => {
        // A 404 is the answer, not a failure: deleted, or no longer readable
        // by this viewer — either way the card has to go.
        if (isApiError(cause) && cause.status === 404) setVisible(false);
        // Anything else is transient — leave visibility as it was until the next frame.
      });
  }, [syncLikeCount]);

  useVideoRealtime(backendVideoIds, user !== null, handleRealtimeFrame);

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
    if (!next || !isBackendVideoId(next.id) || next.commentsDisabled) return;
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
              serverLiked={likes.liked[video.id] ?? false}
              serverLikeCount={likes.counts[video.id] ?? video.stats.likes}
              onLikeConfirmed={likes.confirm}
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
