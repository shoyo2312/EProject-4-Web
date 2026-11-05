import { StudioComments } from "@/components/studio/StudioComments";
import { isBackendVideoId } from "@/lib/api/adapters";

type Props = {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
};

export default async function StudioCommentsRoute({ searchParams }: Props) {
  const { videoId } = await searchParams;
  const wanted = typeof videoId === "string" && isBackendVideoId(videoId) ? videoId : undefined;
  return <StudioComments key={wanted ?? "all"} initialVideoId={wanted} />;
}
