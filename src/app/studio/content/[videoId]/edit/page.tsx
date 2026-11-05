import { notFound } from "next/navigation";

import { StudioEditPost } from "@/components/studio/StudioEditPost";
import { isBackendVideoId } from "@/lib/api/adapters";

type Params = {
  params: Promise<{ videoId: string }>;
};

export default async function EditPostRoute({ params }: Params) {
  const { videoId } = await params;
  if (!isBackendVideoId(videoId)) notFound();
  return <StudioEditPost videoId={videoId} />;
}
