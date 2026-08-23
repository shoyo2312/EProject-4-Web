"use client";

import { useEffect, useState } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { VideoDetail } from "@/components/video/VideoDetail";
import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import { messageFor } from "@/lib/api/errors";
import { getUserVideos, getVideo } from "@/lib/api/videos";
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
   * The collection is the author's own videos, in the order their profile grid
   * lists them: this page is reached by tapping a tile on that grid, so
   * stepping walks the grid the viewer just came from.
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

        // After the video is on screen, not before: a slow or failed listing
        // must cost the page nothing but two disabled buttons.
        const page = await getUserVideos(raw.userId, 0, 30, controller.signal);
        const ids = page.content.map((entry) => entry.id);
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

function VideoDetailSkeleton() {
  return (
    <main className="flex h-screen flex-1 items-center justify-center gap-6">
      <Skeleton className="h-[85vh] w-[calc(85vh*9/16)] rounded-[12px]" />
      <div className="flex w-[400px] flex-col gap-4">
        <div className="flex items-center gap-3">
          <Skeleton className="h-11 w-11 rounded-full" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
      </div>
    </main>
  );
}
