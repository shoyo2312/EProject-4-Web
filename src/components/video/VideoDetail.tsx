"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { CommentPanel } from "@/components/feed/CommentPanel";
import { VideoCard } from "@/components/feed/VideoCard";
import {
  MenuDivider,
  MenuRow,
  PlayerMenuPanel,
  SpeedPills,
  Switch,
} from "@/components/player/PlayerMenu";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useFollow } from "@/hooks/use-follow";
import {
  ArrowPostIcon,
  AutoScrollIcon,
  BookmarkIcon,
  CaptionsIcon,
  CloseIcon,
  CommentIcon,
  FloatingPlayerIcon,
  HeartIcon,
  MoreIcon,
  MutedIcon,
  NotInterestedIcon,
  ReportIcon,
  ShareIcon,
  SpeedIcon,
  VolumeIcon,
} from "@/components/icons";
import { isBackendHandle } from "@/lib/api/adapters";
import {
  getLikeStatus,
  getSaveStatus,
  likeVideo,
  saveVideo,
  shareVideo,
  unlikeVideo,
  unsaveVideo,
} from "@/lib/api/interactions";
import { formatCount } from "@/lib/format";
import { getOverlayOrigin } from "@/lib/overlay-origin";
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
export function VideoDetail({
  video,
  comments,
  previousId,
  nextId,
}: {
  video: FeedVideo;
  comments: Comment[];
  /** Neighbours in the same collection; `null` at either end of it. */
  previousId?: string | null;
  nextId?: string | null;
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
  const [extraShares, setExtraShares] = useState(0);

  // Seed the heart for a returning viewer. Mock videos have no backend to ask.
  useEffect(() => {
    if (!isBackendHandle(video.id)) return;
    let cancelled = false;
    getLikeStatus(video.id)
      .then((status) => {
        if (cancelled) return;
        setLiked(status.liked);
        setLikeCount(status.likeCount);
      })
      .catch(() => {
        // No session, or the call failed — the heart just starts unfilled.
      });
    return () => {
      cancelled = true;
    };
  }, [video.id]);

  const setLike = useCallback(
    (next: boolean) => {
      setLiked(next);
      setLikeCount((count) => count + (next ? 1 : -1));
      if (!isBackendHandle(video.id)) return;

      (next ? likeVideo(video.id) : unlikeVideo(video.id))
        // The optimistic bump above is only a guess at the shared count.
        .then((status) => setLikeCount(status.likeCount))
        .catch(() => {
          // Silent rollback, matching the feed's like button.
          setLiked(!next);
          setLikeCount((count) => count + (next ? -1 : 1));
        });
    },
    [video.id],
  );

  const toggleLike = useCallback(() => setLike(!liked), [liked, setLike]);

  const likeOnly = useCallback(() => {
    if (!liked) setLike(true);
  }, [liked, setLike]);

  const recordShare = useCallback(() => {
    setExtraShares((n) => n + 1);
    if (!isBackendHandle(video.id)) return;
    shareVideo(video.id).catch(() => setExtraShares((n) => n - 1));
  }, [video.id]);

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

  return (
    <main className="flex flex-1 flex-row">
      <div
        ref={playerRef}
        className="relative h-screen flex-1 overflow-hidden overscroll-contain bg-[var(--tt-page)]"
      >
        <button
          type="button"
          onClick={close}
          aria-label="Close video"
          className="absolute top-4 left-4 z-20 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
        >
          <CloseIcon className="h-5 w-5" />
        </button>

        {/* Both float over the player's right edge — i.e. against the comment
            column — with the overflow menu at the top and the volume control at
            the bottom, as far below it as the column is tall. */}
        <div className="absolute top-4 right-4 z-30">
          <MoreMenu
            speed={speed}
            onSpeedChange={setSpeed}
            autoScroll={autoScroll}
            onAutoScrollChange={setAutoScroll}
          />
        </div>

        <div className="absolute bottom-4 right-4 z-20">
          <VerticalVolumeControl
            muted={muted}
            volume={volume}
            onToggleMuted={toggleMuted}
            onVolumeChange={changeVolume}
          />
        </div>

        {/* Previous / next, stacked against the column edge. They go through
            `step` as the wheel does, so both routes animate the same way. */}
        <div className="absolute right-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-3">
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

        <div className="flex h-full items-center justify-center px-4 py-4">
          <div
            className={cn(
              "flex w-full flex-1 justify-center",
              video.width > video.height ? "items-center" : "items-end",
              entering === "next" && "[animation:tt-video-in-next_300ms_ease-out]",
              entering === "previous" && "[animation:tt-video-in-previous_300ms_ease-out]",
            )}
          >
            <VideoCard
              video={video}
              onLike={likeOnly}
              showCaption={false}
              showVolumeControl={false}
              showContextMenu={false}
              onEnded={autoScroll && nextId ? () => step("next") : undefined}
            />
          </div>
        </div>
      </div>

      {/* The right column is fixed-width and never collapses here, so it is a
          plain flex sibling rather than the feed's transitioning wrapper. */}
      {/* `pt-14` clears the fixed TopBar, which floats over this column's top
          edge — the live page reserves the same strip. */}
      <aside className="flex h-screen w-[34rem] flex-none flex-col border-l border-[var(--tt-divider)] pt-14 tt-1280:w-[26rem] tt-1024:w-[22rem]">
        <VideoSummary
          video={video}
          liked={liked}
          likes={likeCount}
          onToggleLike={toggleLike}
          commentCount={video.stats.comments + extraComments}
          shareCount={video.stats.shares + extraShares}
          onShare={recordShare}
        />

        <div className="min-h-0 flex-1">
          <CommentPanel
            variant="detail"
            videoId={video.id}
            videoOwnerId={video.author.userId}
            comments={comments}
            commentCount={video.stats.comments + extraComments}
            onClose={close}
            onCommentAdded={() => setExtraComments((n) => n + 1)}
            onCommentDeleted={() => setExtraComments((n) => n - 1)}
          />
        </div>
      </aside>
    </main>
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
      className={cn(className, disabled && "cursor-default opacity-40 hover:bg-[var(--tt-field)]")}
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
      const next = Math.min(1, Math.max(0, (rect.bottom - clientY) / rect.height));
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
        "relative flex w-12 min-h-12 flex-col-reverse items-center gap-2",
        "rounded-[24px] px-2 pb-0 pt-4",
        "transition-[max-height] duration-300",
        expanded ? "max-h-[200px] bg-[var(--tt-field)]" : "max-h-12",
      )}
    >
      <button
        type="button"
        onClick={onToggleMuted}
        aria-label={muted ? "Unmute" : "Mute"}
        className="flex h-12 w-12 flex-none items-center justify-center rounded-full text-white/90"
      >
        {muted ? <MutedIcon className="h-6 w-6" /> : <VolumeIcon className="h-6 w-6" />}
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
              if (event.key === "ArrowUp") onVolumeChange(Math.min(1, shown + 0.05));
              if (event.key === "ArrowDown") onVolumeChange(Math.max(0, shown - 0.05));
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
 * The three-dot menu in the player's top-right corner.
 *
 * Same chrome and rows as the feed's right-click menu (see `PlayerMenu`), but
 * anchored under its button and ending in Not interested/Report rather than the
 * feed's Download/Share/Copy link — the two menus differ on the live site.
 *
 * Speed and "Auto scroll" reach the player: the rate is applied to the media
 * element, and auto scroll advances to the next video when the clip ends. The
 * clone has nothing behind "Floating Player" or "Captions" (no PiP surface, no
 * caption tracks in the mock feed), so those rows only dismiss the menu.
 */
function MoreMenu({
  speed,
  onSpeedChange,
  autoScroll,
  onAutoScrollChange,
}: {
  speed: number;
  onSpeedChange: (speed: number) => void;
  autoScroll: boolean;
  onAutoScrollChange: (on: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside and Escape both dismiss, as every other popover here does.
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
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {open && (
        <PlayerMenuPanel className="absolute right-0 top-12">
          {/* Not a button — the pills inside it are, and a button cannot nest. */}
          <MenuRow
            icon={<SpeedIcon className="h-5 w-5" />}
            label="Speed"
            trailing={<SpeedPills speed={speed} onSpeedChange={onSpeedChange} />}
          />

          <MenuRow
            icon={<AutoScrollIcon className="h-5 w-5" />}
            label="Auto scroll"
            onClick={() => onAutoScrollChange(!autoScroll)}
            checked={autoScroll}
            trailing={<Switch on={autoScroll} />}
          />

          <MenuRow
            icon={<FloatingPlayerIcon className="h-5 w-5" />}
            label="Floating Player"
            onClick={() => setOpen(false)}
          />

          <MenuRow
            icon={<CaptionsIcon className="h-5 w-5" />}
            label="Captions"
            onClick={() => setOpen(false)}
          />

          <MenuDivider />

          <MenuRow
            icon={<NotInterestedIcon className="h-5 w-5" />}
            label="Not interested"
            onClick={() => setOpen(false)}
          />

          <MenuRow
            icon={<ReportIcon className="h-5 w-5" />}
            label="Report"
            onClick={() => setOpen(false)}
          />
        </PlayerMenuPanel>
      )}
    </div>
  );
}

/** Everything above the comment list: who posted it, what it says, its counts. */
function VideoSummary({
  video,
  liked,
  likes,
  onToggleLike,
  commentCount,
  shareCount,
  onShare,
}: {
  video: FeedVideo;
  liked: boolean;
  /** Reconciled with the server by the page — never derived from `liked`. */
  likes: number;
  onToggleLike: () => void;
  commentCount: number;
  shareCount: number;
  onShare: () => void;
}) {
  const {
    isSelf,
    following,
    toggle: toggleFollow,
  } = useFollow(video.author.userId, video.isFollowing);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);

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

  const toggleSave = () => {
    const next = !saved;
    setSaved(next);
    if (!isBackendHandle(video.id)) return;

    (next ? saveVideo(video.id) : unsaveVideo(video.id)).catch(() => {
      // Silent rollback, matching the heart above it.
      setSaved(!next);
    });
  };

  /**
   * Shown as a path, not `window.location.href`: the origin is unknown during
   * the server render, and reading it after mount would swap the text under the
   * user. The absolute URL is resolved in the click handler, where `window` is
   * always available.
   */
  const sharePath = `/video/${video.id}`;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(new URL(sharePath, window.location.origin).href);
      setCopied(true);
      onShare();
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (insecure origin, permission) — the
      // field still shows the link, so the user can copy it by hand.
    }
  };

  return (
    <div className="flex-none border-b border-[var(--tt-divider)] px-4 pt-4 pb-3">
      <div className="flex items-start gap-3">
        <Image
          src={video.author.avatarUrl}
          alt={video.author.nickname}
          width={40}
          height={40}
          className="h-10 w-10 flex-none rounded-full"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[16px] font-bold leading-[22px] text-[var(--tt-text)]">
            {video.author.username}
          </p>
          <p className="truncate text-[14px] leading-[18px] text-[var(--tt-text-secondary)]">
            {video.author.nickname}
          </p>
        </div>
        {/* Absent on your own video — see the rail's badge. */}
        {!isSelf && (
          <button
            type="button"
            onClick={toggleFollow}
            className={cn(
              "h-8 flex-none rounded-[8px] px-4 text-[15px] font-medium transition-colors",
              following
                ? "border border-[var(--tt-divider)] text-[var(--tt-text)] hover:bg-[var(--tt-field)]"
                : "bg-[var(--tt-red)] text-white hover:bg-[var(--tt-red-hover)]",
            )}
          >
            {following ? "Following" : "Follow"}
          </button>
        )}
      </div>

      <p className="mt-3 text-[16px] leading-[22px] text-[var(--tt-text)]">
        {video.caption}
      </p>

      <div className="mt-2 flex items-center gap-2 text-[14px] text-[var(--tt-text)]">
        <Image
          src={video.music.coverUrl}
          alt=""
          width={20}
          height={20}
          className="h-5 w-5 flex-none rounded-full"
        />
        <span className="truncate">
          {video.music.title} - {video.music.author}
        </span>
      </div>

      {/* The feed's vertical rail, laid out horizontally — same actions, same
          counts, which is how the live site presents them on this page. */}
      <div className="mt-4 flex items-center gap-4">
        <CountButton
          label={liked ? "Unlike" : "Like"}
          onClick={onToggleLike}
          count={likes}
          active={liked}
        >
          <HeartIcon className="h-5 w-5" />
        </CountButton>

        <CountButton label="Comments" count={commentCount}>
          <CommentIcon className="h-5 w-5" />
        </CountButton>

        {/* The count is the mock figure plus the viewer's own: a save is
            private, so there is no shared save_count to read. */}
        <CountButton
          label={saved ? "Remove bookmark" : "Bookmark"}
          onClick={toggleSave}
          count={video.stats.bookmarks + (saved ? 1 : 0)}
          active={saved}
        >
          <BookmarkIcon className="h-5 w-5" />
        </CountButton>

        <CountButton label="Share video" onClick={onShare} count={shareCount}>
          <ShareIcon className="h-5 w-5" />
        </CountButton>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-[8px] bg-[var(--tt-field)] p-1 pl-3">
        <span className="min-w-0 flex-1 truncate text-[14px] text-[var(--tt-text-secondary)]">
          {sharePath}
        </span>
        <button
          type="button"
          onClick={copyLink}
          className="h-8 flex-none rounded-[8px] bg-[var(--tt-shape-neutral-3)] px-3 text-[14px] font-medium text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-sheet-3)]"
        >
          {copied ? "Copied" : "Copy link"}
        </button>
      </div>
    </div>
  );
}

/** A round icon button with its count beside it, as the row above renders. */
function CountButton({
  label,
  count,
  onClick,
  active,
  children,
}: {
  label: string;
  count: number;
  onClick?: () => void;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-pressed={onClick ? Boolean(active) : undefined}
        className={cn(
          "flex h-9 w-9 items-center justify-center rounded-full bg-[var(--tt-field)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]",
          active ? "text-[var(--tt-red)]" : "text-[var(--tt-icon)]",
        )}
      >
        {children}
      </button>
      <span className="text-[13px] font-medium text-[var(--tt-text-secondary)]">
        {formatCount(count)}
      </span>
    </div>
  );
}
