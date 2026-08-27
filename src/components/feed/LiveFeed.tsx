"use client";

import Link from "next/link";

import { Feed } from "@/components/feed/Feed";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
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
    return <FeedSkeleton />;
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
      // `CommentPanel` fetches real comments itself for these (numeric)
      // ids — this map only ever serves the mock fallback branch above.
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

/**
 * Stands in for the first scroll-snap card while the feed loads.
 *
 * Measured in Chrome at 1920×936 against a live card, so the blocks below sit
 * exactly where the real ones land and nothing shifts when the video arrives:
 *
 *   scroller  h-screen, padding-right 64 (the gutter stays in both states)
 *   article   py-4, padding-inline 64 / 176, gap 16
 *   column    1376 wide, items-end — the card and rail sit on the same baseline
 *   player    509 × 904 at this height (9/16 of `--one-column-available-height`), r16
 *   rail      48 wide: avatar 48, then four 78-tall items 8px apart, then the
 *              48 music disc (its live rect reads larger only because it spins)
 *   nav       two 48px buttons, right 16, centred vertically
 */
export function FeedSkeleton() {
  return (
    <main className="flex flex-1 flex-row">
      <div className="relative flex-1 overflow-hidden">
        <div className="no-scrollbar relative h-screen w-full overflow-hidden pr-16 tt-1024:pr-0">
          {/* Same padding ladder as a real `article`, so the card lands on the
              same x at every breakpoint. */}
          <div
            className={cn(
              "relative mx-auto flex items-center justify-center gap-4 overflow-hidden py-4",
              "[min-height:calc(100vh-var(--one-column-top-content-height)-var(--one-column-item-bottom-content-height))]",
              "[padding-inline-start:calc(var(--feed-nav-button-width)+1rem)]",
              "[padding-inline-end:calc(15rem-var(--feed-nav-button-width)-1rem)]",
              "tt-1280:[padding-inline-start:1rem]",
              "tt-1280:[padding-inline-end:calc(15rem-(var(--feed-nav-button-width)*2)-1rem)]",
              "tt-1024:[padding-inline-start:var(--feed-nav-button-width)]",
              "tt-1024:[padding-inline-end:1rem]",
              "tt-768:[padding-inline:1rem]",
            )}
          >
            <div className="flex w-full flex-1 items-end justify-center gap-4">
              <Skeleton
                className={cn(
                  "grow rounded-[1rem] [aspect-ratio:0.5625/1] min-w-[348px]",
                  "[height:var(--one-column-available-height)]",
                  "[max-height:var(--one-column-available-height)]",
                  "[max-width:calc(var(--one-column-available-height)*0.5625)]",
                )}
              />

              <div className="flex w-12 flex-none flex-col items-center gap-2 tt-1024:hidden">
                <Skeleton className="mb-3 h-12 w-12 rounded-full" />
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex h-[78px] w-12 flex-col items-center">
                    <Skeleton className="h-12 w-12 rounded-full" />
                    <Skeleton className="mt-1 h-4 w-6" />
                  </div>
                ))}
                <Skeleton className="mt-1 h-12 w-12 rounded-full" />
              </div>
            </div>
          </div>

          {/* The up/down nav column, which the real feed keeps at the far right. */}
          <div className="absolute top-1/2 right-4 z-10 flex -translate-y-1/2 flex-col gap-4 tt-1024:hidden">
            <Skeleton className="h-12 w-12 rounded-full" />
            <Skeleton className="h-12 w-12 rounded-full" />
          </div>
        </div>
      </div>
    </main>
  );
}
