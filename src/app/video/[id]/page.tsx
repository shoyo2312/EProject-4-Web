import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { BackendVideoDetail } from "@/components/video/BackendVideoDetail";
import { VideoDetail } from "@/components/video/VideoDetail";
import {
  getCommentsForVideo,
  getVideoById,
  getVideoNeighbours,
} from "@/lib/data";

type Params = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ posted?: string }>;
};

/**
 * video-service ids are 19-digit Snowflakes; the mock feed's are "1", "x7",
 * "citylapse~videos~3". Length separates them cleanly, and it is tested as a
 * string — parsing a Snowflake into a JS number loses precision silently.
 */
function isBackendVideoId(id: string): boolean {
  return /^\d{15,}$/.test(id);
}

export async function generateMetadata({
  params,
}: Pick<Params, "params">): Promise<Metadata> {
  const { id } = await params;
  if (isBackendVideoId(id)) return { title: "Nowa" };

  const video = await getVideoById(id);
  if (!video) return { title: "Video not found | Nowa" };

  return {
    title: `${video.author.nickname} on Nowa`,
    description: video.caption,
  };
}

/**
 * The single-video page. Reached from an Explore tile, and it also resolves the
 * feed's own ids, so `/video/1` works as a permalink for a For You video.
 *
 * Backend videos are fetched in the browser instead: the viewer's token decides
 * whether their own PROCESSING or PRIVATE video is visible at all, and the
 * server rendering this page has no token.
 */
export default async function VideoPage({ params, searchParams }: Params) {
  const { id } = await params;

  if (isBackendVideoId(id)) {
    const { posted } = await searchParams;
    return <BackendVideoDetail videoId={id} justPosted={posted === "1"} />;
  }

  const video = await getVideoById(id);
  if (!video) notFound();

  const [comments, neighbours] = await Promise.all([
    getCommentsForVideo(video),
    getVideoNeighbours(id),
  ]);

  return (
    <VideoDetail
      video={video}
      comments={comments}
      previousId={neighbours.previousId}
      nextId={neighbours.nextId}
    />
  );
}
