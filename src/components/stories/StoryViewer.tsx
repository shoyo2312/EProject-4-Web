"use client";

import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useSession } from "@/components/session/SessionProvider";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { useMounted } from "@/hooks/use-mounted";
import { unknownAuthor } from "@/lib/api/adapters";
import { getStory, recordStoryView } from "@/lib/api/stories";
import type { StoryGroup } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { displayMs, next, previous, type StoryPosition } from "@/lib/stories/navigation";
import type { Author } from "@/types/tiktok";

import { useStories } from "./StoriesProvider";
import { StoryOwnerPanel } from "./StoryOwnerPanel";

/** Where an arrow key moves the caret or the choice, not the story. */
const TYPING = "input, textarea, select";

/**
 * Full-screen story player. Plays each owner's stories in order, then the next owner's; clicking
 * the left or right half steps back or on, the arrow keys too, and Escape closes it.
 *
 * Under the viewer's own stories sits `StoryOwnerPanel` — status, viewers, visibility, delete —
 * and playback waits while it has a list or a confirmation open.
 */
export function StoryViewer({
  groups,
  authors,
  start,
  onClose,
  onSeen,
  onOwnStoryChanged,
  onOwnStoryDeleted,
}: {
  groups: readonly StoryGroup[];
  /** Keyed by userId; an owner missing here is shown under a placeholder name. */
  authors: Readonly<Record<string, Author>>;
  start: StoryPosition;
  onClose: () => void;
  onSeen: (storyId: string) => void;
  onOwnStoryChanged: () => void;
  onOwnStoryDeleted: () => void;
}) {
  const { user } = useSession();
  const { syncRings } = useStories();
  const mounted = useMounted();
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [pos, setPos] = useState(start);
  // Tagged with its story so a story never starts from where the one before it stopped.
  const [clock, setClock] = useState({ storyId: "", fraction: 0 });
  const [muted, setMuted] = useState(true);
  // The story whose owner panel has a list or a confirmation open; stepping away releases it.
  const [busyStory, setBusyStory] = useState<string | null>(null);
  const [hidden, setHidden] = useState(false);
  const [freshUrls, setFreshUrls] = useState<Record<string, string>>({});
  const [broken, setBroken] = useState<Record<string, true>>({});
  const retried = useRef(new Set<string>());

  const group = groups[pos.group];
  const story = group?.stories[pos.story];
  const storyId = story?.id;
  const own = story !== undefined && story.userId === user?.userId;
  const mediaUrl = story && !broken[story.id] ? (freshUrls[story.id] ?? story.mediaUrl) : null;
  const progress = clock.storyId === storyId ? clock.fraction : 0;
  const paused = (busyStory !== null && busyStory === storyId) || hidden;

  // Through a ref: a parent's inline `onClose` would otherwise restart the clock on every render.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // The tray, a profile header and the provider each close this player by unmounting it, so this is
  // the one place that sees every way out: the owners just watched then turn grey everywhere.
  const groupsRef = useRef(groups);
  useEffect(() => {
    groupsRef.current = groups;
  });
  useEffect(() => () => syncRings(groupsRef.current), [syncRings]);

  const forward = useCallback(() => {
    const following = next(groups, pos);
    if (following) setPos(following);
    else onCloseRef.current();
  }, [groups, pos]);

  const back = useCallback(() => {
    const earlier = previous(groups, pos);
    if (earlier) setPos(earlier);
  }, [groups, pos]);

  useEscapeKey(onClose);
  useFocusTrap(dialogRef, mounted);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof Element && event.target.closest(TYPING)) return;
      if (event.key === "ArrowRight") forward();
      if (event.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [forward, back]);

  // The Following feed keeps playing under an overlay; its sound would run over the story's.
  useEffect(() => {
    const silenced = Array.from(document.querySelectorAll("video")).filter(
      (video) => !video.paused && !video.closest("[data-story-viewer]"),
    );
    silenced.forEach((video) => video.pause());
    return () => silenced.forEach((video) => void video.play().catch(() => {}));
  }, []);

  // A hidden tab gets no animation frames, and the clock would read the whole absence as watched.
  useEffect(() => {
    const onVisibility = () => setHidden(document.visibilityState === "hidden");
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);

  // Keyed on the id: marking a story seen replaces its object in `groups`, and an effect keyed on
  // the object would mark it, and count it, again on every render after.
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  });
  useEffect(() => {
    if (!storyId || own) return;
    onSeenRef.current(storyId);
    // Counted once per viewer by the server; a failed count is not worth interrupting the story.
    recordStoryView(storyId).catch(() => {});
  }, [storyId, own]);

  // `mediaUrl` is signed for an hour. A tray left open longer fails to load, so the story is read
  // again once for a fresh URL; failing twice, or no longer being visible, shows it as unavailable.
  const recover = useCallback((id: string) => {
    const giveUp = () => setBroken((current) => ({ ...current, [id]: true }));
    if (retried.current.has(id)) {
      giveUp();
      return;
    }
    retried.current.add(id);
    getStory(id)
      .then((fresh) => {
        if (fresh.mediaUrl) setFreshUrls((current) => ({ ...current, [id]: fresh.mediaUrl as string }));
        else giveUp();
      })
      .catch(giveUp);
  }, []);

  // An image, or media that will not load, runs on a clock; a video runs on its own time.
  const clocked = story !== undefined && (story.mediaType === "IMAGE" || !mediaUrl);
  const clockMs = story ? displayMs(story) : 0;
  useEffect(() => {
    if (!storyId || !clocked || paused) return;
    const total = clockMs;
    const startedAt = performance.now() - progress * total;
    let frame = requestAnimationFrame(function tick(now) {
      const fraction = Math.min(1, (now - startedAt) / total);
      setClock({ storyId, fraction });
      if (fraction >= 1) forward();
      else frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
    // `progress` is read once to resume where a pause left off, not tracked.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storyId, clocked, clockMs, paused, forward]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (paused) video.pause();
    else video.play().catch(() => {});
  }, [paused, storyId, mediaUrl]);

  if (!mounted || !group || !story) return null;

  const author = authors[group.userId] ?? unknownAuthor(group.userId);

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${author.nickname}'s story`}
      data-story-viewer=""
      tabIndex={-1}
      className="fixed inset-0 z-[3001] flex items-center justify-center bg-black outline-none"
    >
      <button type="button" onClick={onClose} aria-label="Close"
        className="absolute top-4 right-4 z-20 rounded-full p-2 text-white hover:bg-white/10">
        <X className="h-6 w-6" />
      </button>

      <div className="relative flex aspect-[9/16] h-full max-h-screen w-auto max-w-full flex-col overflow-hidden bg-[#111] sm:h-[92vh] sm:rounded-[12px]">
        <div className="absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/60 to-transparent px-3 pt-3 pb-6">
          <div className="flex gap-1">
            {group.stories.map((item, index) => (
              <progress
                key={item.id}
                max={1}
                value={index < pos.story ? 1 : index === pos.story ? progress : 0}
                className="h-[3px] flex-1 appearance-none overflow-hidden rounded-full [&::-moz-progress-bar]:bg-white [&::-webkit-progress-bar]:bg-white/30 [&::-webkit-progress-value]:bg-white"
              />
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 text-white">
            {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline */}
            <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer"
              className="h-8 w-8 rounded-full bg-[rgb(136_136_136/0.5)] object-cover" />
            <span className="truncate text-[15px] font-semibold">{author.nickname}</span>
            <span className="shrink-0 text-[13px] text-white/70">{formatRelativeTime(story.createdAt)}</span>
            {story.mediaType === "VIDEO" && mediaUrl && (
              <button type="button" onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"} className="ml-auto rounded-full p-1 hover:bg-white/10">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center">
          {!mediaUrl ? (
            <p className="px-6 text-center text-[15px] text-white/70">This story can’t be shown right now.</p>
          ) : story.mediaType === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element -- a presigned URL that expires; the image pipeline would cache it
            <img key={mediaUrl} src={mediaUrl} alt={story.caption ?? ""} onError={() => recover(story.id)}
              className="h-full w-full object-contain" />
          ) : (
            <video
              key={mediaUrl}
              ref={videoRef}
              src={mediaUrl}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                // A browser-recorded WebM carries no length in its header; media-worker probed one.
                const total = Number.isFinite(video.duration) ? video.duration : story.durationSeconds;
                if (total) setClock({ storyId: story.id, fraction: Math.min(1, video.currentTime / total) });
              }}
              onEnded={forward}
              onError={() => recover(story.id)}
              className="h-full w-full object-contain"
            />
          )}

          <button type="button" onClick={back} aria-label="Previous story"
            className="group absolute inset-y-0 left-0 w-1/3 cursor-default">
            <ChevronLeft className="ml-2 hidden h-8 w-8 text-white/80 group-hover:inline" />
          </button>
          <button type="button" onClick={forward} aria-label="Next story"
            className="group absolute inset-y-0 right-0 flex w-2/3 cursor-default items-center justify-end">
            <ChevronRight className="mr-2 hidden h-8 w-8 text-white/80 group-hover:inline" />
          </button>

          {story.caption && (
            <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-5 text-[15px] leading-5 break-words text-white">
              {story.caption}
            </p>
          )}
        </div>

        {own && (
          <div className="relative z-20">
            <StoryOwnerPanel
              key={story.id}
              story={story}
              onBusy={(busy) => setBusyStory(busy ? story.id : null)}
              onChanged={onOwnStoryChanged}
              onDeleted={onOwnStoryDeleted}
            />
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
