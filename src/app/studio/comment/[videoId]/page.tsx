import { notFound } from "next/navigation";

import { StudioVideoComments } from "@/components/studio/StudioVideoComments";
import { isBackendVideoId } from "@/lib/api/adapters";

type Params = {
  params: Promise<{ videoId: string }>;
};

/** `/studio/comment/{videoId}` — one post's comments, as tiktok.com/tiktokstudio/comment/{id}. */
export default async function VideoCommentsRoute({ params }: Params) {
  const { videoId } = await params;
  if (!isBackendVideoId(videoId)) notFound();
  return <StudioVideoComments key={videoId} videoId={videoId} />;
}
