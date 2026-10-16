import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";

import { BackendVideoDetail } from "@/components/video/BackendVideoDetail";
import { isBackendVideoId } from "@/lib/api/adapters";
import { COMMENT_PANEL_COOKIE } from "@/lib/comment-panel";

type Params = {
  params: Promise<{ id: string }>;
};

export const metadata: Metadata = { title: "Nowa" };

/**
 * The single-video page, reached from a feed card, an Explore tile or a
 * profile grid.
 *
 * The video is fetched in the browser: the viewer's token decides whether their
 * own PROCESSING or PRIVATE video is visible at all, and the server rendering
 * this page has no token.
 */
export default async function VideoPage({ params }: Params) {
  const { id } = await params;
  if (!isBackendVideoId(id)) notFound();

  /* The comment panel opens unless the reader closed it last time, and this
     runs on the server so the first paint is already right. */
  const panelOpen = (await cookies()).get(COMMENT_PANEL_COOKIE)?.value !== "0";

  return <BackendVideoDetail videoId={id} initialPanelOpen={panelOpen} />;
}
