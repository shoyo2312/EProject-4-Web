"use client";

import Link from "next/link";

import { Feed } from "@/components/feed/Feed";
import { useVideoFeed } from "@/hooks/use-video-feed";
import type { Comment, FeedVideo } from "@/types/tiktok";

/**
 * "For You", backed by `GET /api/v1/videos/feed`.
 *
 * The feed is public — no token needed — but sending one when we have it is
 * still right, and `lib/api/videos.ts` does. What the viewer sees here is only
 * ever `PUBLISHED` + `PUBLIC` video; their own uploads still transcoding live
 * on their profile, not here.
 *
 * `sampleVideos` is the cloned mock feed. It is shown **only** when the backend
 * cannot be reached at all, so that the UI work is still demonstrable with the
 * services down, and it says so on screen rather than passing mock data off as
 * real. An empty response from a healthy backend is an empty feed, not a cue to
 * fall back.
 */
export function LiveFeed({
  sampleVideos,
  sampleComments,
}: {
  sampleVideos: FeedVideo[];
  sampleComments: Record<string, Comment[]>;
}) {
  const { videos, isLoading, error, loadMore } = useVideoFeed();

  if (isLoading) {
    return (
      <Centered>
        <span className="text-[16px] text-[var(--tt-text-secondary)]">
          Loading videos…
        </span>
      </Centered>
    );
  }

  if (error) {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 z-20 bg-[var(--tt-red-active)]/90 px-4 py-2 text-center text-[13px] leading-5 text-white">
          Can’t reach the API gateway on :8080 — showing sample content.
        </div>
        <Feed videos={sampleVideos} comments={sampleComments} />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <Centered>
        <p className="text-[16px] text-[var(--tt-text)]">No videos yet.</p>
        <Link
          href="/upload"
          className="mt-3 rounded-[4px] bg-[var(--tt-red-active)] px-4 py-2 text-[14px] font-semibold text-white"
        >
          Upload the first one
        </Link>
      </Centered>
    );
  }

  return (
    <Feed
      videos={videos}
      // Comments belong to interaction-service, which is not built yet, so the
      // panel opens empty rather than showing another video's mock thread.
      comments={{}}
      onReachEnd={loadMore}
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center">
      {children}
    </main>
  );
}
