import { notFound } from "next/navigation";

import { StudioVideoAnalytics } from "@/components/studio/StudioVideoAnalytics";
import { isBackendVideoId } from "@/lib/api/adapters";

type Params = {
  params: Promise<{ videoId: string }>;
};

export default async function VideoAnalyticsRoute({ params }: Params) {
  const { videoId } = await params;
  if (!isBackendVideoId(videoId)) notFound();
  return <StudioVideoAnalytics videoId={videoId} />;
}
