import Link from "next/link";

import { PostThumb } from "@/components/studio/PostCell";
import type { CommentResponse, VideoResponse } from "@/lib/api/types";
import { formatRelativeTime } from "@/lib/format";
import type { Author } from "@/types/tiktok";

/**
 * One comment in Studio: who said it, what, when, and on which post. Actions,
 * when given, sit under the text the way TikTok puts Reply and Delete there.
 */
export function CommentRow({
  comment,
  author,
  video,
  actions,
}: {
  comment: CommentResponse;
  author: Author | undefined;
  video: VideoResponse | undefined;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 px-5 py-4">
      {/* eslint-disable-next-line @next/next/no-img-element -- avatar host is whatever user-service allowed */}
      <img
        src={author?.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-10 w-10 flex-none rounded-full bg-black/8 object-cover"
      />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center gap-2 text-[14px] leading-[18px]">
          <Link href={author ? `/@${author.username}` : "#"} className="truncate font-semibold text-black hover:underline">
            {author?.nickname ?? "…"}
          </Link>
          {comment.status === "HELD" && (
            <span className="rounded-[4px] bg-[#ffb800]/15 px-1.5 py-0.5 text-[11px] font-semibold text-[#8a6100]">
              Held for review
            </span>
          )}
        </div>
        <p className="text-[14px] leading-5 break-words whitespace-pre-wrap text-black">{comment.content}</p>
        <div className="flex items-center gap-4 text-[13px] leading-4 text-black/50">
          <span>{formatRelativeTime(comment.createdAt)}</span>
          {actions}
        </div>
      </div>
      <Link href={`/video/${comment.videoId}`} className="flex-none hover:opacity-80" aria-label="Open the post">
        <PostThumb url={video?.thumbnailUrl ?? null} className="h-14 w-[42px]" />
      </Link>
    </div>
  );
}
