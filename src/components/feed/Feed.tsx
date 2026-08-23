"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ActionRail } from "@/components/feed/ActionRail";
import { CommentPanel } from "@/components/feed/CommentPanel";
import { VideoCard } from "@/components/feed/VideoCard";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { isBackendHandle } from "@/lib/api/adapters";
import { getLikeStatus, likeVideo, unlikeVideo } from "@/lib/api/interactions";
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
  // interaction-service has no batch endpoint, so this is one request per
  // backend video on the page; bounded by the feed's own page size (20).
  useEffect(() => {
    if (!user) return;
    const backendIds = videos.filter((v) => isBackendHandle(v.id)).map((v) => v.id);
    if (backendIds.length === 0) return;
    let cancelled = false;

    Promise.allSettled(backendIds.map((id) => getLikeStatus(id))).then((results) => {
      if (cancelled) return;
      setLikedIds((current) => {
        const next = new Set(current);
        results.forEach((result, index) => {
          if (result.status === "fulfilled" && result.value.liked) {
            next.add(backendIds[index]);
          }
        });
        return next;
      });
      setLikeCounts((current) => {
        const next = { ...current };
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[backendIds[index]] = result.value.likeCount;
          }
        });
        return next;
      });
    });

    return () => {
      cancelled = true;
    };
  }, [videos, user]);

  /**
   * Moves one video's count by `delta` from whatever is on screen — the server
   * count if we have one, the count the feed was rendered with otherwise.
   */
  const bumpCount = useCallback(
    (id: string, delta: number) => {
      const rendered = videos.find((video) => video.id === id)?.stats.likes ?? 0;
      setLikeCounts((current) => ({
        ...current,
        [id]: (current[id] ?? rendered) + delta,
      }));
    },
    [videos],
  );

  const setLike = useCallback(
    (id: string, liked: boolean) => {
      setLikedIds((current) => {
        const next = new Set(current);
        if (liked) next.add(id);
        else next.delete(id);
        return next;
      });
      bumpCount(id, liked ? 1 : -1);
      if (!isBackendHandle(id)) return;

      (liked ? likeVideo(id) : unlikeVideo(id))
        // The reply carries the true count, which the optimistic bump only
        // guessed — it is stale the moment anyone else likes the same video.
        .then((status) =>
          setLikeCounts((current) => ({ ...current, [id]: status.likeCount })),
        )
        .catch(() => {
          // Silent rollback — see brainstorming design: no toast, just undo.
          setLikedIds((current) => {
            const next = new Set(current);
            if (liked) next.delete(id);
            else next.add(id);
            return next;
          });
          bumpCount(id, liked ? -1 : 1);
        });
    },
    [bumpCount],
  );

  const toggleLike = useCallback(
    (id: string) => {
      if (!requireSignIn()) return;
      setLike(id, !likedIds.has(id));
    },
    [likedIds, requireSignIn, setLike],
  );

  const likeOnly = useCallback(
    (id: string) => {
      if (!requireSignIn()) return;
      if (likedIds.has(id)) return;
      setLike(id, true);
    },
    [likedIds, requireSignIn, setLike],
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
   * `--comment-sidebar-width` lives on <html> because the TopBar has to read it
   * too and is not a descendant of this component. Writing a class on the root
   * element is a sync to an external system, not derived render state.
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
          {videos.map((video) => (
            <article
              key={video.id}
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
                  "flex w-full flex-1 justify-center gap-4",
                  video.width > video.height ? "items-center" : "items-end",
                )}
              >
                <VideoCard
                  video={video}
                  onLike={() => likeOnly(video.id)}
                  // The feed's counterpart to auto scroll on `/video/[id]`:
                  // there, finishing a clip navigates to the next video; here
                  // it scrolls the snap container on by one card. Passing this
                  // also turns `loop` off, which is what lets `ended` fire.
                  onEnded={autoScroll ? () => scrollByItem(1) : undefined}
                />
                <ActionRail
                  video={video}
                  commentCount={
                    video.stats.comments + (extraComments[video.id] ?? 0)
                  }
                  commentsOpen={commentsOpen && commentVideo?.id === video.id}
                  onCommentClick={() => toggleComments(video)}
                  liked={likedIds.has(video.id)}
                  likes={likeCounts[video.id] ?? video.stats.likes}
                  onToggleLike={() => toggleLike(video.id)}
                />
              </div>
            </article>
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
            comments={comments[commentVideo.id] ?? []}
            commentCount={
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
