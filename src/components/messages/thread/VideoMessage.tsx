"use client";

import { Play, RotateCw, VideoOff } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import type { VideoCard } from "@/lib/api/conversations";
import { cn } from "@/lib/utils";

/**
 * A shared video in the history: a portrait card with its thumbnail, a play mark and its title, that
 * opens the video's own page. Nothing plays here — a list of cards must not start a list of videos.
 *
 * The card has a fixed size while it can be played (a thumbnail still loading never moves the reader's
 * place). The server reads it on every load: a video that went private, was removed or is held back for
 * review comes back as UNAVAILABLE and is a short notice with no thumbnail or title; so is an outage,
 * which says so instead of claiming the video is gone.
 */
export function VideoMessage({
  video,
  mine,
  onOpen,
}: {
  video: VideoCard | null | undefined;
  mine: boolean;
  /** Called as the card is followed to the video, so the page can be told what to step through. */
  onOpen?: () => void;
}) {
  const [failed, setFailed] = useState<string | null>(null);

  // A video that cannot be shown is a small notice, not a screenful of empty card.
  if (!video || video.state !== "AVAILABLE") {
    const unknown = video?.state === "UNKNOWN";
    return (
      <div
        role="img"
        aria-label={unknown ? "Video couldn't be loaded" : "Video unavailable"}
        className="flex h-[84px] w-[236px] flex-none items-center gap-3 rounded-[var(--chat-radius-bubble)] border border-[var(--chat-line)] bg-[var(--chat-raised)] px-4"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-white/[0.07] text-[var(--chat-meta)]">
          {unknown ? <RotateCw aria-hidden className="h-[18px] w-[18px]" /> : <VideoOff aria-hidden className="h-[18px] w-[18px]" />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13.5px] leading-[18px] font-semibold text-[var(--tt-text)]">
            {unknown ? "Couldn't load this video right now" : "This video isn't available"}
          </span>
          <span className="block text-[12px] leading-4 text-[var(--chat-meta)]">
            {unknown ? "Reopen the chat to try again" : "It may have been removed or made private"}
          </span>
        </span>
      </div>
    );
  }

  const broken = !video.thumbnailUrl || failed === video.thumbnailUrl;
  return (
    <Link
      href={`/video/${video.videoId}`}
      onClick={onOpen}
      aria-label={video.title ? `Open video: ${video.title}` : "Open video"}
      className="group/video relative block h-[320px] w-[180px] flex-none overflow-hidden rounded-[var(--chat-radius-bubble)] bg-[var(--chat-raised)] ring-1 ring-white/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      {!broken && (
        // eslint-disable-next-line @next/next/no-img-element -- a fixed-size thumbnail from the media store; next/image would need its host allow-listed
        <img
          src={video.thumbnailUrl ?? undefined}
          alt=""
          decoding="async"
          loading="lazy"
          onError={() => setFailed(video.thumbnailUrl)}
          className="h-full w-full object-cover transition-transform duration-300 group-hover/video:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover/video:scale-100"
        />
      )}
      {video.durationSeconds ? (
        <span className="absolute top-2.5 left-2.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] leading-4 font-medium text-white tabular-nums">
          {formatDuration(video.durationSeconds)}
        </span>
      ) : null}
      <span aria-hidden className="absolute inset-0 flex items-center justify-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/45 text-white ring-1 ring-white/25 transition-colors group-hover/video:bg-black/60">
          <Play className="ml-0.5 h-5 w-5 fill-white" />
        </span>
      </span>
      {video.title && (
        <span
          className={cn(
            "absolute inset-x-0 bottom-0 line-clamp-2 bg-gradient-to-t from-black/75 via-black/40 to-transparent px-3 pt-8 pb-2.5 text-[13px] leading-[18px] font-semibold text-white",
            mine ? "text-right" : "text-left",
          )}
        >
          {video.title}
        </span>
      )}
    </Link>
  );
}

/** 24 -> "0:24", 125 -> "2:05". */
function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}
