"use client";

import { ChevronLeft, ChevronRight, Volume2, VolumeX, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useEscapeKey } from "@/hooks/use-escape-key";
import { useMounted } from "@/hooks/use-mounted";
import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import { recordStoryView } from "@/lib/api/stories";
import type { StoryGroup, StoryResponse, UserProfileResponse } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import { displayMs, next, previous, type StoryPosition } from "@/lib/stories/navigation";

/**
 * Full-screen story player. Plays each owner's stories in order, then the next owner's; clicking
 * the left or right half steps back or on, the arrow keys too, and Escape closes it.
 *
 * `ownerFooter` renders under the viewer's own stories — status, viewers, visibility, delete —
 * and pauses playback while `paused` says so, so a menu opened over a story is not cut short.
 */
export function StoryViewer({
  groups,
  profiles,
  start,
  viewerId,
  onClose,
  onSeen,
  ownerFooter,
  paused = false,
}: {
  groups: readonly StoryGroup[];
  profiles: Record<string, UserProfileResponse>;
  start: StoryPosition;
  viewerId: string | null;
  onClose: () => void;
  onSeen: (storyId: string) => void;
  ownerFooter?: (story: StoryResponse) => React.ReactNode;
  paused?: boolean;
}) {
  const mounted = useMounted();
  const [pos, setPos] = useState(start);
  const [progress, setProgress] = useState(0);
  const [muted, setMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement>(null);

  const group = groups[pos.group];
  const story = group?.stories[pos.story];
  const own = story !== undefined && story.userId === viewerId;

  const forward = useCallback(() => {
    const following = next(groups, pos);
    if (following) setPos(following);
    else onClose();
  }, [groups, pos, onClose]);

  const back = useCallback(() => {
    const earlier = previous(groups, pos);
    if (earlier) setPos(earlier);
  }, [groups, pos]);

  useEscapeKey(onClose);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") forward();
      if (event.key === "ArrowLeft") back();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [forward, back]);

  // Keyed on the id: marking a story seen replaces its object in `groups`, and an effect keyed on
  // the object would mark it, and count it, again on every render after.
  const storyId = story?.id;
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

  useEffect(() => {
    setProgress(0);
  }, [storyId]);

  // An image, or a video that could not be loaded, runs on a clock; a video runs on its own time.
  const clocked = story !== undefined && (story.mediaType === "IMAGE" || !story.mediaUrl);
  const clockMs = story ? displayMs(story) : 0;
  useEffect(() => {
    if (!storyId || !clocked || paused) return;
    const total = clockMs;
    const startedAt = performance.now() - progress * total;
    let frame = requestAnimationFrame(function tick(now) {
      const fraction = Math.min(1, (now - startedAt) / total);
      setProgress(fraction);
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
  }, [paused, storyId]);

  if (!mounted || !group || !story) return null;

  const profile = profiles[group.userId];
  const author = profile ? authorFromProfile(profile) : unknownAuthor(group.userId);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`${author.nickname}'s story`}
      className="fixed inset-0 z-[3001] flex items-center justify-center bg-black">
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
            <span className="text-[13px] text-white/70">{formatRelativeTime(story.createdAt)}</span>
            {story.mediaType === "VIDEO" && story.mediaUrl && (
              <button type="button" onClick={() => setMuted((value) => !value)}
                aria-label={muted ? "Unmute" : "Mute"} className="ml-auto rounded-full p-1 hover:bg-white/10">
                {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
              </button>
            )}
          </div>
        </div>

        <div className="relative flex flex-1 items-center justify-center">
          {!story.mediaUrl ? (
            <p className="px-6 text-center text-[15px] text-white/70">This story can’t be shown right now.</p>
          ) : story.mediaType === "IMAGE" ? (
            // eslint-disable-next-line @next/next/no-img-element -- a presigned URL that expires; the image pipeline would cache it
            <img src={story.mediaUrl} alt={story.caption ?? ""} className="h-full w-full object-contain" />
          ) : (
            <video
              key={story.id}
              ref={videoRef}
              src={story.mediaUrl}
              autoPlay
              playsInline
              muted={muted}
              onTimeUpdate={(event) => {
                const video = event.currentTarget;
                if (video.duration) setProgress(video.currentTime / video.duration);
              }}
              onEnded={forward}
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
        </div>

        {story.caption && (
          <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-5 text-[15px] leading-5 break-words text-white">
            {story.caption}
          </p>
        )}

        {own && ownerFooter && <div className="relative z-20">{ownerFooter(story)}</div>}
      </div>
    </div>,
    document.body,
  );
}
