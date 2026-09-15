"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionRail } from "@/components/feed/ActionRail";
import { CommentPanel } from "@/components/feed/CommentPanel";
import { RepostBadge } from "@/components/feed/RepostBadge";
import { VideoCard } from "@/components/feed/VideoCard";
import { CreatorVideosPanel } from "@/components/video/CreatorVideosPanel";
import { SpeedPills, Switch } from "@/components/player/PlayerMenu";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { COMMENT_PANEL_COOKIE } from "@/lib/comment-panel";
import { useClampOverflow } from "@/hooks/use-clamp-overflow";
import { useFollow } from "@/hooks/use-follow";
import { useSession } from "@/components/session/SessionProvider";
import { useVideoRealtime, type VideoFrame } from "@/hooks/useVideoRealtime";
import type { VideoPlayback } from "@/hooks/use-video-playback";
import { Trash2 } from "lucide-react";

import {
  ArrowPostIcon,
  CloseIcon,
  EyeOffIcon,
  MoreIcon,
  MutedIcon,
  PlayIcon,
  ReportIcon,
  VolumeIcon,
} from "@/components/icons";
import { isBackendHandle } from "@/lib/api/adapters";
import { getAccessToken } from "@/lib/api/tokens";
import {
  getLikeStatus,
  getSaveStatus,
  likeVideo,
  saveVideo,
  unlikeVideo,
  unsaveVideo,
} from "@/lib/api/interactions";
import {
  deleteVideo,
  updateVideoCommentsSetting,
  updateVideoVisibility,
} from "@/lib/api/videos";
import type { VideoVisibility } from "@/lib/api/types";
import { VIDEO_REPORT_REASONS } from "@/lib/api/reports";
import { getOverlayOrigin } from "@/lib/overlay-origin";
import { Modal } from "@/components/ui/modal";
import { ReportDialog } from "@/components/report/ReportDialog";
import { toast } from "@/components/ui/toast";
import { formatDuration, formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { Comment, FeedVideo } from "@/types/tiktok";

type Step = "next" | "previous";

/**
 * Which way the last in-page step went, so the incoming page knows which edge
 * to slide in from. Module scope rather than state or storage: a step is always
 * a client-side navigation, which unmounts this component but keeps the module
 * loaded, and a fresh load (where this is null) correctly gets no animation.
 */
let lastStep: Step | null = null;

/** Below this the wheel is treated as noise — a rounding tick, not a gesture. */
const WHEEL_NOISE = 2;

/**
 * A gesture is over once the wheel has been quiet for this long. Momentum from
 * a trackpad flick keeps firing well past the flick itself, so the gap between
 * events — not their total distance — is what separates one gesture from two.
 */
const WHEEL_IDLE_MS = 220;

/*
 * The gesture guard lives at module scope for the same reason `lastStep` does:
 * stepping unmounts this component and mounts the next one, so a guard held in
 * the component would be thrown away exactly when it is needed — the momentum
 * tail of the flick that navigated would arrive at a fresh listener and step
 * again. These two carry it across the navigation instead.
 */
let inGesture = false;
let gestureIdle: ReturnType<typeof setTimeout> | undefined;

/** Restarted on every wheel event; firing it ends the current gesture. */
function armGestureIdle() {
  clearTimeout(gestureIdle);
  gestureIdle = setTimeout(() => {
    inGesture = false;
  }, WHEEL_IDLE_MS);
}

/**
 * `/video/[id]` — the single-video view a grid tile opens into.
 *
 * Two columns, as the live site lays this page out: the player fills the left,
 * and everything textual moves into a fixed-width right column — author row,
 * caption, track, the engagement counts (horizontal here, not the feed's
 * vertical rail) and a copy-link field, with the comment list filling the rest.
 */
/**
 * Stepping to the next video routes to `/video/<id>`, which remounts this
 * component — so the panel's open/closed state has to outlive it, or a reader
 * who closed the panel gets it back on every swipe.
 *
 * Two layers hold it: this module variable answers instantly on a client
 * navigation, and {@link COMMENT_PANEL_COOKIE} carries it across a reload,
 * read on the server so the first HTML already has the panel the right way
 * round — no open-then-collapse flash, and nothing to mismatch on hydration.
 */
let panelOpenPreference: boolean | null = null;

/** What the loading skeleton needs to know: does the panel come back open? */
export function isCommentPanelOpen(fromServer: boolean) {
  return panelOpenPreference ?? fromServer;
}

export function VideoDetail({
  video,
  comments,
  previousId,
  nextId,
  initialPanelOpen = true,
}: {
  video: FeedVideo;
  comments: Comment[];
  /** Neighbours in the same collection; `null` at either end of it. */
  previousId?: string | null;
  nextId?: string | null;
  /** The reader's last choice, as the cookie left it. */
  initialPanelOpen?: boolean;
}) {
  const router = useRouter();
  /*
   * All app-wide: arriving from the feed keeps the sound the viewer chose, and
   * the two overflow-menu preferences that reach the player survive the step to
   * the next video — which remounts this component, so component state used to
   * throw them away on every step.
   */
  const {
    muted,
    volume,
    toggleMuted,
    changeVolume,
    speed,
    setSpeed,
    autoScroll,
    setAutoScroll,
  } = usePlayerSettings();
  const [liked, setLiked] = useState(false);
  /**
   * Server-known count, overriding the rendered one. `stats.likes` already
   * counts the viewer's own like, so a filled heart must not add another.
   */
  const [likeCount, setLikeCount] = useState(video.stats.likes);
  const [extraComments, setExtraComments] = useState(0);
  const [saved, setSaved] = useState(false);

  /**
   * Latest counts frame for this video. Without it the comment tally only ever
   * moved for the tab that posted: `stats.comments` is fixed at page load and
   * `extraComments` is this tab's own delta, so a second tab drew the incoming
   * comment (the panel has its own subscription) beside a count that never
   * budged. Same source of truth as the feed's cards — see `Feed`.
   */
  const [liveFrame, setLiveFrame] = useState<VideoFrame | null>(null);
  const realtimeIds = useMemo(
    () => (isBackendHandle(video.id) ? [video.id] : []),
    [video.id],
  );
  const { user: sessionUser } = useSession();
  useVideoRealtime(
    realtimeIds,
    sessionUser ? getAccessToken() : null,
    useCallback((frame: VideoFrame) => {
      // `state` frames carry no counters; only the counts ones say anything here.
      if (frame.type === "counts") setLiveFrame(frame);
    }, []),
  );
  // The frame is authoritative — it already counts this tab's own comments, so
  // the local delta is only the gap before the first frame lands.
  const commentCount =
    liveFrame?.commentCount ?? video.stats.comments + extraComments;

  // Seed the bookmark for a returning viewer. One video, so this asks about
  // that video rather than reading the whole favourites list as the feed does.
  useEffect(() => {
    if (!isBackendHandle(video.id)) return;
    let cancelled = false;
    getSaveStatus(video.id)
      .then((status) => {
        if (!cancelled) setSaved(status.saved);
      })
      .catch(() => {
        // Signed out, or the call failed — the bookmark starts unfilled.
      });
    return () => {
      cancelled = true;
    };
  }, [video.id]);

  const toggleSave = useCallback(() => {
    setSaved((current) => {
      const next = !current;
      if (isBackendHandle(video.id)) {
        (next ? saveVideo(video.id) : unsaveVideo(video.id)).catch(() => {
          // Silent rollback, matching the heart above it.
          setSaved(current);
        });
      }
      return next;
    });
  }, [video.id]);

  /** Set while a like/unlike round trip is open, so a poll landing mid-flight
   *  does not overwrite the optimistic heart with a server count that has not
   *  caught up yet — the mutation's own `.then` is the authority in that window. */
  const likeInFlight = useRef(false);

  /**
   * Seed the heart for a returning viewer, then keep the count live. The like
   * count moves whenever anyone else likes the video; `getLikeStatus` returns
   * the absolute figure, so re-asking it on an interval is the whole of the
   * refresh — no reload needed. Mock videos have no backend to ask.
   *
   * Deliberately dumb polling. A single open video page does not warrant a live
   * channel; if the comment list needs the same treatment that is where SSE
   * earns its keep, not here.
   */
  useEffect(() => {
    if (!isBackendHandle(video.id)) return;
    let cancelled = false;

    const sync = () =>
      getLikeStatus(video.id)
        .then((status) => {
          if (cancelled || likeInFlight.current) return;
          setLiked(status.liked);
          setLikeCount(status.likeCount);
        })
        .catch(() => {
          // No session, or the call failed — leave whatever is on screen.
        });

    sync();
    const id = setInterval(() => {
      if (document.visibilityState === "visible") sync();
    }, 10_000);

    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [video.id]);

  const setLike = useCallback(
    (next: boolean) => {
      setLiked(next);
      setLikeCount((count) => count + (next ? 1 : -1));
      if (!isBackendHandle(video.id)) return;

      likeInFlight.current = true;
      (next ? likeVideo(video.id) : unlikeVideo(video.id))
        // The optimistic bump above is only a guess at the shared count.
        .then((status) => setLikeCount(status.likeCount))
        .catch(() => {
          // Silent rollback, matching the feed's like button.
          setLiked(!next);
          setLikeCount((count) => count + (next ? -1 : 1));
        })
        .finally(() => {
          likeInFlight.current = false;
        });
    },
    [video.id],
  );

  const toggleLike = useCallback(() => setLike(!liked), [liked, setLike]);

  const likeOnly = useCallback(() => {
    if (!liked) setLike(true);
  }, [liked, setLike]);

  /**
   * `router.back()` keeps the Explore scroll position, so it is preferred — but
   * only when the overlay was opened from inside the app. On a direct visit (a
   * refresh, a shared link, a search result) the entry behind us belongs to
   * somebody else, so going back would leave the site: push the grid instead.
   */
  const close = useCallback(() => {
    const origin = getOverlayOrigin();
    if (origin) router.back();
    else router.push("/explore");
  }, [router]);

  const step = useCallback(
    (direction: Step) => {
      const id = direction === "next" ? nextId : previousId;
      if (!id) return;
      lastStep = direction;
      // `replace`, not `push`: stepping between videos is a swap inside the same
      // overlay, so it must not stack history entries — otherwise Close walks
      // back through every video visited instead of returning to the grid.
      router.replace(`/video/${id}`);
    },
    [router, nextId, previousId],
  );

  /*
   * Wheel-to-step, standing in for the feed's scroll-snap: this page is one
   * video per route, so there is nothing to scroll and the wheel has to be
   * translated into a navigation. Bound to the player column only, so the
   * comment list beside it keeps scrolling normally.
   *
   * The feed gets its feel from `scroll-snap-stop: always`, which advances
   * exactly one video per gesture however hard it was thrown. That is what is
   * reproduced here, so a light flick moves too: the *first* real tick of a
   * gesture steps immediately, and everything after it is swallowed until the
   * wheel falls quiet — rather than waiting for some distance to add up, which
   * is what made a gentle scroll do nothing.
   */
  const playerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = playerRef.current;
    if (!el) return;

    const onWheel = (event: WheelEvent) => {
      /*
       * A modal opened from inside this column (report, privacy, delete) is
       * still in the column's subtree, so its wheel events bubble here. Left
       * alone they were swallowed by `preventDefault` and stepped the video
       * instead of scrolling the sheet. While one is open the wheel belongs to
       * it — over its backdrop too, where stepping the video underneath is
       * just as wrong.
       */
      if (document.querySelector("[role='dialog']")) return;

      // The column has nowhere to scroll, so this only suppresses overscroll.
      event.preventDefault();
      if (Math.abs(event.deltaY) < WHEEL_NOISE) return;

      // Still inside the gesture that already stepped — keep it alive so the
      // momentum tail cannot start a second one, and ignore it.
      armGestureIdle();
      if (inGesture) return;

      inGesture = true;
      step(event.deltaY > 0 ? "next" : "previous");
    };

    // The idle timer is deliberately left running by the cleanup: unmounting is
    // usually the step itself, and the incoming page needs the guard intact.
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [step]);

  /*
   * Captured on the first render and held for this page's lifetime, so the
   * animation runs once. Only `step` ever writes `lastStep`, and that only runs
   * in the browser, so a server render always reads null here.
   */
  const [entering] = useState<Step | null>(() => lastStep);

  useEffect(() => {
    lastStep = null;
  }, []);

  /*
   * The card's own clock, lifted out so the control bar under the player can
   * drive it — the live site's timeline and play button live in the column,
   * not over the media. Null until the card has mounted and published it.
   */
  const [playback, setPlayback] = useState<VideoPlayback | null>(null);

  const [tab, setTab] = useState<PanelTab>("comments");

  /*
   * The active-tab rule is one element shared by both tabs so it can slide
   * between them; its geometry is measured from the selected button after
   * every render that can move it (label swap, panel reopen).
   */
  const tablistRef = useRef<HTMLDivElement>(null);
  /**
   * Side column starts open (live detail does too). Closing it hands the
   * full width to the player; the comment rail button toggles the same flag.
   */
  const [panelOpen, setPanelOpen] = useState(
    panelOpenPreference ?? initialPanelOpen,
  );

  useEffect(() => {
    panelOpenPreference = panelOpen;
    document.cookie = `${COMMENT_PANEL_COOKIE}=${panelOpen ? "1" : "0"}; path=/; max-age=31536000; samesite=lax`;
  }, [panelOpen]);
  /* Mock authors have no backend id, so there is no listing to build the tab
     from — it is dropped rather than shown empty. */
  const creatorId = video.author.userId;

  const closePanel = useCallback(() => setPanelOpen(false), []);

  const togglePanel = useCallback(() => {
    if (panelOpen) {
      // Open on Creator videos → jump to Comments; already on Comments → close.
      if (tab === "creator") {
        setTab("comments");
        return;
      }
      setPanelOpen(false);
      return;
    }
    setTab("comments");
    setPanelOpen(true);
  }, [panelOpen, tab]);

  useEffect(() => {
    const list = tablistRef.current;
    const active = list?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!list || !active) return;
    // Written straight to the element: geometry is not React state, and a
    // render pass here would only re-measure what the DOM already knows.
    // Rects rather than offsetLeft: the rule is positioned against the list's
    // padding box, which is what `clientLeft` backs out of a border-box rect.
    const listRect = list.getBoundingClientRect();
    const rect = active.getBoundingClientRect();
    list.style.setProperty(
      "--tab-rule-left",
      `${rect.left - listRect.left - list.clientLeft}px`,
    );
    list.style.setProperty("--tab-rule-width", `${rect.width}px`);
  }, [tab, creatorId, panelOpen]);

  return (
    <main className="flex min-w-0 flex-1 flex-row">
      <div
        ref={playerRef}
        /*
         * What the media may not grow into: the seek bar (20px) and the control
         * bar (52px) below it.
         *
         * The whole expression is restated rather than just overriding
         * `--one-column-item-bottom-content-height`, which is what the feed
         * does. That variable is substituted where
         * `--one-column-available-height` is *declared* — at `:root`, where it
         * is 0px — not where the card reads it, so setting it here changed
         * nothing: a portrait card kept its full-viewport height and ran under
         * the seek bar. Landscape only looked right because its width cap bound
         * first and hid the same bug.
         */
        style={
          {
            "--one-column-available-height": "calc(100vh - 72px - 2rem)",
          } as React.CSSProperties
        }
        className="group/column relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden overscroll-contain bg-[var(--tt-page)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close video"
          className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        {/* Previous / next, stacked against the column edge. They go through
            `step` as the wheel does, so both routes animate the same way. */}
        <div className="absolute right-6 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
          <OverlayButton
            label="Previous video"
            onClick={() => step("previous")}
            disabled={!previousId}
          >
            <ArrowPostIcon className="h-5 w-5" />
          </OverlayButton>

          <OverlayButton
            label="Next video"
            onClick={() => step("next")}
            disabled={!nextId}
          >
            <ArrowPostIcon className="h-5 w-5 rotate-180" />
          </OverlayButton>
        </div>

        {/* Media band. Everything textual floats in the gutters *beside* the
            media rather than over it, which is why this is one positioned box
            with the card centred inside it. */}
        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-4">
          <div
            className={cn(
              // `w-full` is load-bearing: the card sizes itself with `grow`
              // plus a max-width cap, so a shrink-to-fit row leaves it at 0.
              "flex h-full w-full min-w-0 items-center justify-center",
              entering === "next" &&
                "[animation:tt-video-in-next_300ms_ease-out]",
              entering === "previous" &&
                "[animation:tt-video-in-previous_300ms_ease-out]",
            )}
          >
            <VideoCard
              video={video}
              onLike={likeOnly}
              showCaption={false}
              showVolumeControl={false}
              showContextMenu={false}
              showProgressBar={false}
              onPlayback={setPlayback}
              onEnded={autoScroll && nextId ? () => step("next") : undefined}
            />
          </div>

          {/* Author/caption on the left, engagement on the right, both sitting
              on the same baseline immediately above the seek bar — measured at
              16px and 24px from the column's edges on the live site. */}
          <div className="pointer-events-none absolute inset-x-4 bottom-0 flex items-end justify-between gap-6">
            <VideoMeta
              video={video}
              className="pointer-events-auto w-[480px] max-w-[55%]"
            />
            <div className="pointer-events-auto mr-2">
              <ActionRail
                compact
                video={video}
                commentCount={commentCount}
                commentsOpen={panelOpen}
                onCommentClick={togglePanel}
                liked={liked}
                likes={likeCount}
                onToggleLike={toggleLike}
                saved={saved}
                onToggleSave={toggleSave}
              />
            </div>
          </div>
        </div>

        {/* 16px in from each edge, the full width of the column — not of the
            media, which is the whole change from the feed's in-card bar. */}
        <SeekBar
          currentTime={playback?.currentTime ?? 0}
          duration={playback?.duration ?? video.durationSeconds}
          onSeek={playback?.seekToFraction}
        />

        <ControlBar
          video={video}
          onDeleted={close}
          isPlaying={playback?.isPlaying ?? false}
          currentTime={playback?.currentTime ?? 0}
          duration={playback?.duration ?? video.durationSeconds}
          onTogglePlay={playback?.togglePlay}
          speed={speed}
          onSpeedChange={setSpeed}
          autoScroll={autoScroll}
          onAutoScrollChange={setAutoScroll}
          muted={muted}
          volume={volume}
          onToggleMuted={toggleMuted}
          onVolumeChange={changeVolume}
        />
      </div>

      {/*
       * Same collapse pattern as the feed's comment sidebar: width transitions
       * over 300ms linear, content stays mounted at its open width so
       * `overflow: hidden` clips it instead of reflowing mid-animation.
       */}
      <aside
        className={cn(
          // 16px top inset, matching the player column's gutter; the height
          // loses that inset so the column still fits the viewport.
          "z-[8] m-4 h-[calc(100vh-32px)] flex-none overflow-hidden rounded-[1rem] bg-[var(--tt-comment-panel)]",
          "transition-[width] duration-300 ease-linear",
          panelOpen
            ? "w-[28.75rem] tt-1280:w-[24rem] tt-1024:w-[20rem]"
            : "w-0 border-l-transparent",
        )}
      >
        <div
          className="flex h-full w-[28.75rem] flex-col tt-1280:w-[24rem] tt-1024:w-[20rem]"
          // Keep the clipped column out of the tab order while collapsed.
          inert={panelOpen ? undefined : true}
          aria-hidden={!panelOpen}
        >
          <div className="flex flex-none items-center justify-between gap-4 px-4 pt-4">
            <div
              ref={tablistRef}
              role="tablist"
              // Stretches into the free space so the rule runs up to the close
              // button, never under it; the left pad lengthens it further.
              className="relative flex min-w-0 flex-1 items-center gap-6 border-b border-[var(--tt-divider)] pl-4"
            >
              <PanelTabButton
                active={tab === "comments"}
                onClick={() => setTab("comments")}
              >
                Comments
              </PanelTabButton>
              {creatorId && (
                <PanelTabButton
                  active={tab === "creator"}
                  onClick={() => setTab("creator")}
                >
                  Creator videos
                </PanelTabButton>
              )}
              <span
                aria-hidden
                className="absolute bottom-0 h-0.5 rounded-full bg-[var(--tt-text)] transition-[left,width] duration-300 ease-out"
                style={{
                  left: "var(--tab-rule-left, 0px)",
                  width: "var(--tab-rule-width, 0px)",
                }}
              />
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close panel"
              className="flex h-7 w-7 flex-none self-start items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
            >
              <CloseIcon className="h-[14px] w-[14px]" />
            </button>
          </div>

          {/* One tab at a time, each owning the column's whole remaining height —
              there is no summary block above it any more. */}
          <div className="min-h-0 flex-1">
            {tab === "comments" || !creatorId ? (
              <CommentPanel
                variant="detail"
                videoId={video.id}
                videoOwnerId={video.author.userId}
                comments={comments}
                commentsDisabled={video.commentsDisabled}
                commentCount={commentCount}
                onClose={closePanel}
                onCommentAdded={() => setExtraComments((n) => n + 1)}
                onCommentDeleted={() => setExtraComments((n) => n - 1)}
              />
            ) : (
              <CreatorVideosPanel
                userId={creatorId}
                currentVideoId={video.id}
                onSelect={(id) => router.replace(`/video/${id}`)}
              />
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}

type PanelTab = "comments" | "creator";

/** One label in the side panel's tab row — active is white over a 2px rule. */
function PanelTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative h-10 text-[15px] font-semibold transition-colors",
        active
          ? "text-[var(--tt-text)]"
          : "text-[var(--tt-text-secondary)] hover:text-[var(--tt-text)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * A round control floating over the player. `disabled` dims it, which is how
 * the first and last video of a collection show there is nothing to step to.
 */
function OverlayButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        className,
        disabled && "cursor-default opacity-40 hover:bg-[var(--tt-field)]",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The feed's `VolumeControl`, turned on its side for this page: the button is
 * pinned to the player's bottom-right corner, so the slider has to grow upward
 * — a rightward one would run into the comment column.
 *
 * Same parts and sizes as the horizontal original (48px button, 128px track,
 * a midpoint notch, a knob with no filled portion behind it, 300ms grow), with
 * every axis swapped: the box expands in `max-height`, the track is 6px wide by
 * 128px tall, and the knob is measured from the track's bottom, so full volume
 * is at the top.
 */
function VerticalVolumeControl({
  muted,
  volume,
  onToggleMuted,
  onVolumeChange,
}: {
  muted: boolean;
  volume: number;
  onToggleMuted: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  const [hovered, setHovered] = useState(false);
  const [dragging, setDragging] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const shown = muted ? 0 : volume;
  const expanded = hovered || dragging;

  const setFromClientY = useCallback(
    (clientY: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.height === 0) return;
      const next = Math.min(
        1,
        Math.max(0, (rect.bottom - clientY) / rect.height),
      );
      onVolumeChange(next);
    },
    [onVolumeChange],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => setFromClientY(event.clientY);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, setFromClientY]);

  return (
    <div
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      className={cn(
        // Column-reverse so the button keeps its place at the bottom and the
        // slider appears above it.
        "relative flex w-9 min-h-9 flex-col-reverse items-center gap-2",
        "rounded-[18px] px-1.5 pb-0 pt-4",
        "transition-[max-height] duration-300",
        expanded ? "max-h-[190px] bg-[var(--tt-field)]" : "max-h-9",
      )}
    >
      <button
        type="button"
        onClick={onToggleMuted}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-white/90"
      >
        {muted ? (
          <MutedIcon className="h-6 w-6" />
        ) : (
          <VolumeIcon className="h-6 w-6" />
        )}
      </button>

      {expanded && (
        <div
          ref={trackRef}
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            setDragging(true);
            setFromClientY(event.clientY);
          }}
          className="relative flex h-32 w-8 flex-none cursor-pointer justify-center"
        >
          <div className="h-full w-1.5 rounded-[3px] bg-[rgba(255,255,255,0.19)]" />
          <span className="pointer-events-none absolute top-1/2 h-[3px] w-2.5 rounded-[2px] bg-[rgba(255,255,255,0.32)]" />
          <span
            role="slider"
            tabIndex={0}
            aria-label="Volume"
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(shown * 100)}
            onKeyDown={(event) => {
              if (event.key === "ArrowUp")
                onVolumeChange(Math.min(1, shown + 0.05));
              if (event.key === "ArrowDown")
                onVolumeChange(Math.max(0, shown - 0.05));
            }}
            className="absolute h-5 w-6 rounded-[8px] bg-[rgb(250,250,250)]"
            style={{ bottom: `calc(${shown * 100}% - 10px)` }}
          />
        </div>
      )}
    </div>
  );
}

/**
 * The block in the player column's bottom-left gutter: author · when it was
 * posted, then the title and caption under it.
 *
 * Measured on the live site: a 480px-wide box 16px in from the column's left
 * edge, its own bottom sitting on the same line as the action rail's, 8px
 * above the seek bar. The author is 17px/500 and the "· 6d ago" beside it
 * 15px/500; the caption is 14px.
 */
function VideoMeta({
  video,
  className,
}: {
  video: FeedVideo;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const isDescriptionOverflowing = useClampOverflow(
    descriptionRef,
    video.description,
  );

  return (
    <div className={cn("flex flex-col gap-3 pb-2", className)}>
      {/* Above the owner line — same badge the feed cards carry. */}
      <div className="flex justify-start">
        <RepostBadge videoId={video.id} />
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={`/@${video.author.username}`}
          className="truncate text-[17px] font-medium leading-[22px] text-[var(--tt-text)] hover:underline"
        >
          {video.author.nickname}
        </Link>
        {/* Mock videos carry no upload date; the separator goes with it. */}
        {video.createdAt && (
          <span className="flex-none text-[15px] font-medium leading-5 text-[var(--tt-text-secondary)]">
            · {formatRelativeTime(video.createdAt)}
          </span>
        )}
      </div>

      {video.title && (
        <p className="text-[15px] font-bold leading-[20px] text-[var(--tt-text)]">
          {video.title}
        </p>
      )}

      {video.description && (
        <div>
          <p
            ref={descriptionRef}
            className={cn(
              "text-[14px] leading-[18px] text-[var(--tt-text)]",
              !expanded && "line-clamp-2",
            )}
          >
            {renderCaption(video.description)}
          </p>
          {(expanded || isDescriptionOverflowing) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-[14px] font-bold leading-[18px] text-[var(--tt-text)] hover:underline"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * The timeline, below the media and as wide as the column allows — 16px in
 * from each edge, a 2px track that thickens to 4px while pointed at, and a red
 * elapsed portion. The scrub head is deliberately invisible during playback
 * (the live bar shows none) and only appears while the bar itself is hovered
 * or dragged, which is what makes it grabbable at all.
 */
function SeekBar({
  currentTime,
  duration,
  onSeek,
}: {
  currentTime: number;
  duration: number;
  onSeek?: (fraction: number) => void;
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);

  const seekFromClientX = useCallback(
    (clientX: number) => {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect || rect.width === 0) return;
      onSeek?.((clientX - rect.left) / rect.width);
    },
    [onSeek],
  );

  useEffect(() => {
    if (!dragging) return;
    const onMove = (event: PointerEvent) => seekFromClientX(event.clientX);
    const onUp = () => setDragging(false);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [dragging, seekFromClientX]);

  const fraction = duration > 0 ? Math.min(1, currentTime / duration) : 0;

  return (
    <div
      role="slider"
      tabIndex={0}
      aria-label="Seek"
      aria-valuemin={0}
      aria-valuemax={Math.round(duration)}
      aria-valuenow={Math.round(currentTime)}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        setDragging(true);
        seekFromClientX(event.clientX);
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") onSeek?.(fraction + 0.02);
        if (event.key === "ArrowLeft") onSeek?.(fraction - 0.02);
      }}
      className="group/seek relative mx-4 flex h-5 flex-none cursor-pointer items-center"
    >
      <div
        ref={trackRef}
        className={cn(
          "w-full rounded-full bg-[var(--tt-progress-track)] transition-[height] duration-150 ease-in-out",
          dragging ? "h-1" : "h-0.5 group-hover/seek:h-1",
        )}
      />
      <div
        className={cn(
          "pointer-events-none absolute left-0 rounded-full bg-[var(--tt-progress-elapsed)] transition-[height] duration-150 ease-in-out",
          dragging ? "h-1" : "h-0.5 group-hover/seek:h-1",
        )}
        style={{ width: `${fraction * 100}%` }}
      />
      <span
        className={cn(
          "pointer-events-none absolute h-3 w-3 -translate-x-1/2 rounded-full bg-white transition-opacity duration-150",
          dragging ? "opacity-100" : "opacity-0 group-hover/seek:opacity-100",
        )}
        style={{ left: `${fraction * 100}%` }}
      />
    </div>
  );
}

/**
 * The 52px strip under the seek bar. Play/pause and the clock on the left, the
 * settings cluster on the right — auto scroll, speed, volume. The live bar
 * ends in a "…" and a captions toggle; neither is reproduced (there are no
 * caption tracks here, and the menu behind "…" has no home on this page).
 */
function ControlBar({
  video,
  onDeleted,
  isPlaying,
  currentTime,
  duration,
  onTogglePlay,
  speed,
  onSpeedChange,
  autoScroll,
  onAutoScrollChange,
  muted,
  volume,
  onToggleMuted,
  onVolumeChange,
}: {
  video: FeedVideo;
  /** Called once the owner's own video is deleted — closes the overlay. */
  onDeleted: () => void;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  onTogglePlay?: () => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoScroll: boolean;
  onAutoScrollChange: (on: boolean) => void;
  muted: boolean;
  volume: number;
  onToggleMuted: () => void;
  onVolumeChange: (volume: number) => void;
}) {
  return (
    <div className="flex h-[30px] flex-none items-center justify-between px-2 mb-8">
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-label={isPlaying ? "Pause" : "Play"}
          className="flex h-9 w-9 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
        >
          {isPlaying ? (
            <PauseGlyph className="h-7 w-7" />
          ) : (
            <PlayIcon className="h-7 w-7" />
          )}
        </button>
        <span className="text-[16px] font-light text-[var(--tt-text)]">
          {formatDuration(currentTime)} / {formatDuration(duration)}
        </span>
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          role="switch"
          aria-checked={autoScroll}
          onClick={() => onAutoScrollChange(!autoScroll)}
          className="flex h-9 items-center gap-2 rounded-[8px] px-2 text-[14px] font-semibold text-[var(--tt-text)]"
        >
          Auto scroll
          <Switch on={autoScroll} />
        </button>

        <SpeedControl speed={speed} onSpeedChange={onSpeedChange} />

        {/* Anchored to the bar's bottom edge so the slider grows up over the
            player instead of stretching the bar. */}
        <div className="relative h-9 w-9">
          <div className="absolute bottom-0 right-0">
            <VerticalVolumeControl
              muted={muted}
              volume={volume}
              onToggleMuted={onToggleMuted}
              onVolumeChange={onVolumeChange}
            />
          </div>
        </div>

        <VideoActionsControl video={video} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

/** The "1.0x" button and the speed group it opens above itself. */
function SpeedControl({
  speed,
  onSpeedChange,
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Playback speed"
        className="flex h-8 items-center rounded-[8px] px-3 text-[14px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)]"
      >
        {speed.toFixed(1)}x
      </button>

      {open && (
        <div className="absolute bottom-11 right-0 rounded-full bg-[var(--tt-sheet-3,#252525)] p-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]">
          <SpeedPills speed={speed} onSpeedChange={onSpeedChange} />
        </div>
      )}
    </div>
  );
}

/** No pause glyph in `icons.tsx` — two bars, matching `PlayIcon`'s 48 box. */
function PauseGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      fill="currentColor"
      className={className}
      aria-hidden
    >
      <path d="M13 8h7v32h-7V8Zm15 0h7v32h-7V8Z" />
    </svg>
  );
}

/**
 * Splits a caption so each `#hashtag` renders in the interactive blue TikTok
 * uses for mentions and tags, leaving the surrounding text untouched. Unicode
 * letter/number classes so Vietnamese tags ("#chảnh") match too.
 */
function renderCaption(text: string): React.ReactNode {
  return text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="text-[var(--tt-mention)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

/**
 * The rightmost control in the player's bottom bar, beside volume. Which one it
 * is depends on who is watching: the owner gets their privacy/delete menu, and
 * everybody else gets Report. A mock video has no backend to call, so the owner
 * branch is skipped there and the viewer branch reports nothing.
 */
function VideoActionsControl({
  video,
  onDeleted,
}: {
  video: FeedVideo;
  onDeleted: () => void;
}) {
  const { isSelf } = useFollow(video.author.userId, video.isFollowing);

  if (!isBackendHandle(video.id)) return null;

  return isSelf ? (
    <OwnerControls
      videoId={video.id}
      initialVisibility={video.visibility}
      initialCommentsDisabled={video.commentsDisabled}
      onDeleted={onDeleted}
    />
  ) : (
    <ReportControl videoId={video.id} />
  );
}

/**
 * Report, for a viewer who is not the owner: pick a reason from the list, read
 * back what that reason covers, then submit. The second step is the point —
 * it is the only chance to bounce a mistaken report before it reaches a
 * moderator's queue.
 */
function ReportControl({ videoId }: { videoId: string }) {
  const { user, openLogin } = useSession();
  const [menuOpen, setMenuOpen] = useState(false);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape dismiss, as `OwnerControls` and every other popover
  // on this page does.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {/* The live bar's "…" menu: icon + label rows over a dark sheet. Ours has
          the one row the clone can act on. */}
      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-11 z-[101] w-36 overflow-hidden rounded-[8px] bg-[#252525] shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              if (!user) {
                openLogin();
                return;
              }
              setOpen(true);
            }}
            className="flex w-full items-center gap-3 px-6 py-3 text-left text-[var(--tt-text)] hover:bg-white/10"
          >
            <ReportIcon className="h-5 w-5 flex-none" />
            Report
          </button>
        </div>
      )}

      {open && (
        <ReportDialog
          targetType="VIDEO"
          targetId={videoId}
          reasons={VIDEO_REPORT_REASONS}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

/**
 * The owner's own control on the author row, in place of Follow — modelled on
 * the live TikTok video page: a "…" button opening a two-item menu.
 *
 *   Privacy settings  →  a modal with a "Who can watch this video" select
 *                        (Everyone→PUBLIC, Friends→FRIENDS, Only you→PRIVATE)
 *                        and an "Allow comments" toggle. Both edit drafts only;
 *                        each changed one is sent when "Done" is clicked.
 *   Delete            →  a confirm modal, then `DELETE /videos/{id}` and the
 *                        overlay closes.
 */
function OwnerControls({
  videoId,
  initialVisibility,
  initialCommentsDisabled,
  onDeleted,
}: {
  videoId: string;
  initialVisibility?: VideoVisibility;
  initialCommentsDisabled?: boolean;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "privacy" | "delete">(null);
  // Committed values vs. the drafts the modal edits; each changed draft is sent
  // on "Done".
  const [visibility, setVisibility] = useState<VideoVisibility>(
    initialVisibility ?? "PUBLIC",
  );
  const [draftVisibility, setDraftVisibility] = useState(visibility);
  const [commentsOff, setCommentsOff] = useState(
    Boolean(initialCommentsDisabled),
  );
  const [draftCommentsOff, setDraftCommentsOff] = useState(commentsOff);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape dismiss, as every other popover on this page does.
  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [menuOpen]);

  // Sent only when "Done" is clicked — one request per changed setting.
  const saveSettings = () => {
    const jobs: Promise<unknown>[] = [];
    if (draftVisibility !== visibility) {
      jobs.push(
        updateVideoVisibility(videoId, draftVisibility).then(() =>
          setVisibility(draftVisibility),
        ),
      );
    }
    if (draftCommentsOff !== commentsOff) {
      jobs.push(
        updateVideoCommentsSetting(videoId, draftCommentsOff).then(() =>
          setCommentsOff(draftCommentsOff),
        ),
      );
    }
    if (jobs.length === 0) {
      setDialog(null);
      return;
    }
    setSavingSettings(true);
    Promise.all(jobs)
      .then(() => {
        setDialog(null);
        toast.success("Settings updated.");
      })
      .catch(() => toast.error("Couldn’t update settings. Please try again."))
      .finally(() => setSavingSettings(false));
  };

  const confirmDelete = () => {
    setDeleting(true);
    deleteVideo(videoId)
      .then(() => {
        toast.success("Video deleted.");
        onDeleted();
      })
      .catch(() => {
        setDeleting(false);
        toast.error("Couldn’t delete the video. Please try again.");
      });
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-10 z-[101] w-44 overflow-hidden rounded-[8px] bg-[#252525] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDraftVisibility(visibility);
              setDraftCommentsOff(commentsOff);
              setDialog("privacy");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[15px] text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10"
          >
            <EyeOffIcon className="h-4 w-4 flex-none" />
            Privacy settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDialog("delete");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[15px] text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4 flex-none" strokeWidth={2} />
            Delete
          </button>
        </div>
      )}

      {dialog === "privacy" && (
        <Modal onClose={() => setDialog(null)}>
          <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
            Privacy settings
          </h2>
          <p className="mt-5 text-[15px] font-semibold text-[var(--tt-text)]">
            Who can watch this video
          </p>
          <select
            value={draftVisibility}
            onChange={(event) =>
              setDraftVisibility(event.target.value as VideoVisibility)
            }
            className="mt-2 w-full rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-field)] px-3 py-2 text-[15px] text-[var(--tt-text)]"
          >
            <option value="PUBLIC">Everyone</option>
            <option value="FRIENDS">Friends</option>
            <option value="PRIVATE">Only you</option>
          </select>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[var(--tt-text)]">
              Allow comments
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!draftCommentsOff}
              aria-label="Allow comments"
              onClick={() => setDraftCommentsOff((v) => !v)}
              className={cn(
                "inline-flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors",
                draftCommentsOff
                  ? "bg-[var(--tt-field)]"
                  : "bg-[var(--tt-red)]",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full bg-white transition-transform",
                  draftCommentsOff ? "translate-x-0" : "translate-x-5",
                )}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-6 w-full text-center text-[16px] font-semibold text-[var(--tt-text)] hover:opacity-80 disabled:opacity-60"
          >
            {savingSettings ? "Saving…" : "Done"}
          </button>
        </Modal>
      )}

      {dialog === "delete" && (
        <Modal
          onClose={() => {
            if (!deleting) setDialog(null);
          }}
        >
          <h2 className="text-center text-[18px] font-bold text-[var(--tt-text)]">
            Are you sure you want to delete this video?
          </h2>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-11 rounded-[8px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setDialog(null)}
              disabled={deleting}
              className="h-11 rounded-[8px] border border-[var(--tt-divider)] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

