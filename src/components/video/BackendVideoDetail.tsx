"use client";

import { useEffect, useState } from "react";

import { CommentListSkeleton } from "@/components/feed/CommentPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { VideoDetail } from "@/components/video/VideoDetail";
import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import { messageFor } from "@/lib/api/errors";
import { getUserVideos, getVideo, pollUntilReady } from "@/lib/api/videos";
import { getOverlayCollection } from "@/lib/overlay-origin";
import type { VideoStatus } from "@/lib/api/types";
import type { FeedVideo } from "@/types/tiktok";

/**
 * `/video/{snowflakeId}` — one video from video-service.
 *
 * The token is sent on this GET even though the endpoint is public, and that
 * matters: without it the owner cannot see their own PROCESSING or PRIVATE
 * video and gets a 404 that reads like the upload vanished. A 404 here is
 * deliberately ambiguous anyway — missing, deleted, private, or not published —
 * so the message never guesses which.
 */
export function BackendVideoDetail({ videoId }: { videoId: string }) {
  const [video, setVideo] = useState<FeedVideo | null>(null);
  const [status, setStatus] = useState<VideoStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  /**
   * The ids either side of this one, for the up/down controls. Both were pinned
   * to null, which left the buttons permanently disabled — a backend video had
   * no collection to step through at all.
   *
   * The collection is whichever grid opened this page — a Favorites or Liked
   * grid stashes its own ordered id list (see `overlay-origin`), and only a
   * grid that stashed none (the author's own Videos tab, or a direct visit)
   * falls back to listing the author's uploads.
   */
  const [neighbours, setNeighbours] = useState<{
    previousId: string | null;
    nextId: string | null;
  }>({ previousId: null, nextId: null });

  useEffect(() => {
    const controller = new AbortController();
    let rendered = false;

    (async () => {
      try {
        const raw = await getVideo(videoId, controller.signal);
        const author = await resolveAuthor(raw.userId);
        setStatus(raw.status);
        setVideo(videoToFeedVideo(raw, author));
        rendered = true;

        /**
         * Arriving straight from `/upload` the video is still PROCESSING and
         * has no HLS URL, so the first fetch can only render a poster. Poll it
         * — deliberately not awaited — and swap in the playable version the
         * moment transcoding finishes, instead of leaving a dead frame until
         * the viewer reloads.
         */
        if (raw.status === "PROCESSING") {
          void pollUntilReady(
            videoId,
            (latest) => {
              setStatus(latest.status);
              setVideo(videoToFeedVideo(latest, author));
            },
            controller.signal,
          ).catch(() => {
            // A poll that dies changes nothing on screen: the banner stays.
          });
        }

        // A grid that stashed its own id list (Favorites, Liked) steps through
        // that, with no request at all. Only when there is none — the author's
        // Videos tab, or a direct visit — list the author's uploads instead.
        const stashed = getOverlayCollection();
        const ids =
          stashed?.includes(videoId)
            ? stashed
            : (
                // After the video is on screen, not before: a slow or failed
                // listing must cost the page nothing but two disabled buttons.
                await getUserVideos(raw.userId, 0, 30, controller.signal)
              ).content.map((entry) => entry.id);
        const index = ids.indexOf(videoId);
        if (index === -1) return;
        setNeighbours({
          previousId: index > 0 ? ids[index - 1] : null,
          nextId: index < ids.length - 1 ? ids[index + 1] : null,
        });
      } catch (cause) {
        // Only the first fetch can leave the page with nothing to show; a
        // listing that failed after it just leaves the buttons disabled.
        if (!controller.signal.aborted && !rendered) setError(messageFor(cause));
      }
    })();

    return () => controller.abort();
  }, [videoId]);

  if (error) return <Centered>{error}</Centered>;
  if (!video) return <VideoDetailSkeleton />;

  return (
    <>
      {status !== "PUBLISHED" && (
        <div className="fixed inset-x-0 top-0 z-[200] bg-black/80 px-4 py-2 text-center text-[13px] leading-5 text-white">
          {STATUS_NOTE[status ?? "PROCESSING"]}
        </div>
      )}
      <VideoDetail
        video={video}
        // `VideoDetail`'s `CommentPanel` fetches real comments itself from
        // this video's (numeric) id — this prop only serves mock ids.
        comments={[]}
        previousId={neighbours.previousId}
        nextId={neighbours.nextId}
      />
    </>
  );
}

/** Only the owner ever sees any of these — everyone else got a 404. */
const STATUS_NOTE: Record<VideoStatus, string> = {
  PROCESSING: "Still processing — it will play once transcoding finishes.",
  PUBLISHED: "",
  FAILED: "Transcoding failed. Delete this video and upload it again.",
  TAKEN_DOWN: "This video was taken down by a moderator.",
};

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-1 items-center justify-center text-[16px] text-[var(--tt-text-secondary)]">
      {children}
    </main>
  );
}

/**
 * Placeholder for `VideoDetail` while `GET /videos/:id` is in flight.
 *
 * Measured in Chrome at 1920×936 against `/video/2` (a portrait clip), so the
 * blocks land where the real page puts them:
 *
 *   left      flex-1 beside the 34rem column; player 509 × 904, r16, centred
 *   overlays  close 40 at (16,16), menu 40 at top-right, two 40 nav buttons
 *             centred vertically, 48 volume button bottom-right
 *   summary   pt-14 clears the TopBar; rows at y 72 / 124 / 154 / 191 / 243,
 *             then the divider at 296
 *   comments  header 42 tall, list starts at 354
 */
function VideoDetailSkeleton() {
  return (
    <main className="flex flex-1 flex-row">
      <div className="relative h-screen flex-1 overflow-hidden bg-[var(--tt-page)]">
        <Skeleton className="absolute top-4 left-4 z-20 h-10 w-10 rounded-full" />
        <Skeleton className="absolute top-4 right-4 z-20 h-10 w-10 rounded-full" />

        <div className="absolute top-1/2 right-4 z-20 flex -translate-y-1/2 flex-col gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        <Skeleton className="absolute right-4 bottom-4 z-20 h-12 w-12 rounded-full" />

        <div className="flex h-full items-center justify-center px-4 py-4">
          <Skeleton
            className={cn(
              "grow rounded-[1rem] [aspect-ratio:0.5625/1] min-w-[348px]",
              "[height:var(--one-column-available-height)]",
              "[max-height:var(--one-column-available-height)]",
              "[max-width:calc(var(--one-column-available-height)*0.5625)]",
            )}
          />
        </div>
      </div>

      <aside className="flex h-screen w-[34rem] flex-none flex-col border-l border-[var(--tt-divider)] pt-14 tt-1280:w-[26rem] tt-1024:w-[22rem]">
        <div className="flex-none border-b border-[var(--tt-divider)] px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-10 w-10 flex-none rounded-full" />
            <div className="flex min-w-0 flex-1 flex-col">
              <Skeleton className="h-[22px] w-32" />
              <Skeleton className="h-[18px] w-40" />
            </div>
            <Skeleton className="h-8 w-[78px] flex-none rounded-[8px]" />
          </div>

          {/* caption, then the music row */}
          <Skeleton className="mt-3 h-[22px] w-3/4" />
          <Skeleton className="mt-2 h-[21px] w-48" />

          {/* like / comment / save / share counts */}
          <div className="mt-4 flex items-center gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-9 w-[72px] rounded-full" />
            ))}
          </div>

          {/* the copy-link bar */}
          <Skeleton className="mt-4 h-10 w-full rounded-[8px]" />
        </div>

        <div className="min-h-0 flex-1 px-4 pt-4">
          <div className="pb-4">
            <Skeleton className="h-[26px] w-40" />
          </div>
          <CommentListSkeleton />
        </div>
      </aside>
    </main>
  );
}
