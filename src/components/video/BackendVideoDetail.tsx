"use client";

import { useEffect, useState } from "react";

import { VideoDetail } from "@/components/video/VideoDetail";
import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import { messageFor } from "@/lib/api/errors";
import { getVideo } from "@/lib/api/videos";
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

  useEffect(() => {
    const controller = new AbortController();

    (async () => {
      try {
        const raw = await getVideo(videoId, controller.signal);
        const author = await resolveAuthor(raw.userId);
        setStatus(raw.status);
        setVideo(videoToFeedVideo(raw, author));
      } catch (cause) {
        if (!controller.signal.aborted) setError(messageFor(cause));
      }
    })();

    return () => controller.abort();
  }, [videoId]);

  if (error) return <Centered>{error}</Centered>;
  if (!video) return <Centered>Loading video…</Centered>;

  return (
    <>
      {status !== "PUBLISHED" && (
        <div className="fixed inset-x-0 top-0 z-[200] bg-black/80 px-4 py-2 text-center text-[13px] leading-5 text-white">
          {STATUS_NOTE[status ?? "PROCESSING"]}
        </div>
      )}
      <VideoDetail
        video={video}
        // interaction-service owns comments and is not wired up yet.
        comments={[]}
        previousId={null}
        nextId={null}
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
