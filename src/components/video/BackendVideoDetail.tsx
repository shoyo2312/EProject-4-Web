"use client";

import { useEffect, useState } from "react";

import { CommentListSkeleton } from "@/components/feed/CommentPanel";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  isCommentPanelOpen,
  VideoDetail,
} from "@/components/video/VideoDetail";
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
export function BackendVideoDetail({
  videoId,
  initialPanelOpen = true,
}: {
  videoId: string;
  /** The reader's last panel choice, read from the cookie on the server. */
  initialPanelOpen?: boolean;
}) {
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
        const ids = stashed?.includes(videoId)
          ? stashed
          : // After the video is on screen, not before: a slow or failed
            // listing must cost the page nothing but two disabled buttons.
            (
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
        if (!controller.signal.aborted && !rendered)
          setError(messageFor(cause));
      }
    })();

    return () => controller.abort();
  }, [videoId]);

  if (error) return <Centered>{error}</Centered>;
  if (!video)
    return <VideoDetailSkeleton initialPanelOpen={initialPanelOpen} />;

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
        initialPanelOpen={initialPanelOpen}
      />
    </>
  );
}

/** Only the owner ever sees any of these — everyone else got a 404. */
const STATUS_NOTE: Record<VideoStatus, string> = {
  PROCESSING: "Still processing — it will play once transcoding finishes.",
  PENDING_MODERATION:
    "Being checked — it goes live as soon as the check clears.",
  PENDING_REVIEW: "Waiting on a moderator. It goes live once it is approved.",
  PUBLISHED: "",
  FAILED: "Transcoding failed. Delete this video and upload it again.",
  REJECTED:
    "Removed automatically for likely adult content. Contact support to have it reviewed.",
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
 * Mirrors the current detail layout (not the retired summary-block column):
 *
 *   left   flex-1 player column; close + prev/next overlays; media centred;
 *          author/rail gutters above the seek + control bars
 *   right  28.75rem / 24rem / 20rem; Comments | Creator videos tabs, then the
 *          comment header + list skeleton that {@link CommentPanel} uses
 */
function VideoDetailSkeleton({
  initialPanelOpen,
}: {
  initialPanelOpen: boolean;
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-row">
      <div
        // The media placeholder is capped by the same expression the live
        // column declares, or it grows past the seek + control bars.
        style={
          {
            "--one-column-available-height": "calc(100vh - 72px - 2rem)",
          } as React.CSSProperties
        }
        className="relative flex h-screen min-w-0 flex-1 flex-col overflow-hidden bg-[var(--tt-page)]"
      >
        <Skeleton className="absolute top-4 left-4 z-20 h-10 w-10 rounded-full" />

        <div className="absolute top-1/2 right-6 z-20 flex -translate-y-1/2 flex-col gap-3">
          <Skeleton className="h-10 w-10 rounded-full" />
          <Skeleton className="h-10 w-10 rounded-full" />
        </div>

        <div className="relative flex min-h-0 flex-1 items-center justify-center px-4 pt-4">
          <Skeleton
            className={cn(
              "grow rounded-[1rem] [aspect-ratio:0.5625/1] min-w-[348px] tt-1024:min-w-0",
              "[height:var(--one-column-available-height)]",
              "[max-height:var(--one-column-available-height)]",
              "[max-width:min(calc(var(--one-column-available-height)*0.5625),100%)]",
              "tt-1024:[height:auto]",
            )}
          />

          <div className="pointer-events-none absolute inset-x-4 bottom-0 flex items-end justify-between gap-6">
            {/* 32px author row, 12px gap, 20px caption line — the stack
                `VideoMeta` renders. */}
            <div className="w-[480px] max-w-[55%] space-y-3 pb-2">
              <Skeleton className="h-8 w-40" />
              <Skeleton className="h-5 w-3/4" />
            </div>
            {/* Avatar, then four 52px cells (a 32px control over its count),
                as `ActionRail` lays them out in compact mode. */}
            <div className="mr-2 flex flex-col items-center">
              <Skeleton className="mb-2.5 h-8 w-8 rounded-full" />
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="flex h-[52px] w-8 flex-col items-center"
                >
                  <Skeleton className="h-8 w-8 rounded-full" />
                  <Skeleton className="mt-1 h-3 w-6" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 20px seek band around a 3px track, then the 30px control row and
            its 32px bottom margin — the bands `SeekBar` and `ControlBar` own. */}
        <div className="mx-4 flex h-5 flex-none items-center">
          <Skeleton className="h-[3px] w-full rounded-full" />
        </div>
        <div className="mb-8 flex h-[30px] flex-none items-center gap-3 px-2">
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-4 w-24" />
          <div className="flex-1" />
          <Skeleton className="h-6 w-6 rounded-full" />
          <Skeleton className="h-6 w-6 rounded-full" />
        </div>
      </div>

      {/* A reader who closed the panel gets no skeleton of it, but the column
          still leaves the collapsed panel's gutter, as the live page does. */}
      <aside
        className={cn(
          "m-4 flex h-[calc(100vh-32px)] flex-none flex-col overflow-hidden rounded-[1rem] bg-[var(--tt-comment-panel)]",
          isCommentPanelOpen(initialPanelOpen)
            ? "w-[28.75rem] tt-1280:w-[24rem] tt-1024:w-[20rem]"
            : "w-0",
        )}
      >
        {isCommentPanelOpen(initialPanelOpen) && (
          <>
            <div className="flex flex-none items-center justify-between gap-6 px-4 pt-4">
              <div className="flex items-center gap-6">
                <Skeleton className="h-10 w-[88px]" />
                <Skeleton className="h-10 w-[118px]" />
              </div>
              <Skeleton className="h-8 w-8 rounded-full" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col px-4 pt-4 pb-5">
              <div className="flex flex-none items-center justify-between pb-4">
                <Skeleton className="h-[26px] w-40" />
              </div>
              <div className="min-h-0 flex-1 overflow-hidden">
                <CommentListSkeleton />
              </div>
              <Skeleton className="mt-3 h-12 w-full rounded-full" />
            </div>
          </>
        )}
      </aside>
    </main>
  );
}
