"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ActionRail } from "@/components/feed/ActionRail";
import { CommentPanel } from "@/components/feed/CommentPanel";
import { VideoCard } from "@/components/feed/VideoCard";
import { CloseIcon, ArrowPostIcon } from "@/components/icons";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { ControlBar } from "@/components/video/detail/ControlBar";
import { OverlayButton } from "@/components/video/detail/OverlayButton";
import { PanelTabButton } from "@/components/video/detail/PanelTabButton";
import { SeekBar } from "@/components/video/detail/SeekBar";
import { VideoMeta } from "@/components/video/detail/VideoMeta";
import { useWheelStep } from "@/components/video/detail/use-wheel-step";
import { CreatorVideosPanel } from "@/components/video/CreatorVideosPanel";
import { useVideoLike } from "@/hooks/use-video-like";
import type { VideoPlayback } from "@/hooks/use-video-playback";
import { useVideoRealtime, type VideoFrame } from "@/hooks/use-video-realtime";
import { useVideoSave } from "@/hooks/use-video-save";
import { isBackendHandle } from "@/lib/api/adapters";
import { getAccessToken } from "@/lib/api/tokens";
import { COMMENT_PANEL_COOKIE } from "@/lib/comment-panel";
import { getOverlayOrigin } from "@/lib/overlay-origin";
import { cn } from "@/lib/utils";
import type { Comment, FeedVideo } from "@/types/tiktok";

type Step = "next" | "previous";
type PanelTab = "comments" | "creator";

/**
 * Which way the last in-page step went, so the incoming page knows which edge
 * to slide in from. Module scope rather than state or storage: a step is always
 * a client-side navigation, which unmounts this component but keeps the module
 * loaded, and a fresh load (where this is null) correctly gets no animation.
 */
let lastStep: Step | null = null;

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
  const [extraComments, setExtraComments] = useState(0);

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

  const { liked, likeCount, toggleLike, likeOnly } = useVideoLike(
    video.id,
    video.stats.likes,
  );
  const { saved, toggleSave } = useVideoSave(video.id);

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

  const playerRef = useRef<HTMLDivElement>(null);
  useWheelStep(playerRef, step);

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
