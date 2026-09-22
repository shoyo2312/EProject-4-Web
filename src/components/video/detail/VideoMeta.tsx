"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import { RepostBadge } from "@/components/feed/RepostBadge";
import { useClampOverflow } from "@/hooks/use-clamp-overflow";
import { formatRelativeTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/types/tiktok";

/**
 * The block in the player column's bottom-left gutter: author · when it was
 * posted, then the title and caption under it.
 *
 * Measured on the live site: a 480px-wide box 16px in from the column's left
 * edge, its own bottom sitting on the same line as the action rail's, 8px
 * above the seek bar. The author is 17px/500 and the "· 6d ago" beside it
 * 15px/500; the caption is 14px.
 */
export function VideoMeta({
  video,
  className,
}: {
  video: FeedVideo;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const isDescriptionOverflowing = useClampOverflow(
    descriptionRef,
    video.description,
  );

  return (
    <div className={cn("flex flex-col gap-3 pb-2", className)}>
      {/* Above the owner line — same badge the feed cards carry. */}
      <div className="flex justify-start">
        <RepostBadge videoId={video.id} />
      </div>

      <div className="flex items-center gap-1">
        <Link
          href={`/@${video.author.username}`}
          className="truncate text-[17px] font-medium leading-[22px] text-[var(--tt-text)] hover:underline"
        >
          {video.author.nickname}
        </Link>
        {/* Mock videos carry no upload date; the separator goes with it. */}
        {video.createdAt && (
          <span className="flex-none text-[15px] font-medium leading-5 text-[var(--tt-text-secondary)]">
            · {formatRelativeTime(video.createdAt)}
          </span>
        )}
      </div>

      {video.title && (
        <p className="text-[15px] font-bold leading-[20px] text-[var(--tt-text)]">
          {video.title}
        </p>
      )}

      {video.description && (
        <div>
          <p
            ref={descriptionRef}
            className={cn(
              "text-[14px] leading-[18px] text-[var(--tt-text)]",
              !expanded && "line-clamp-2",
            )}
          >
            {renderCaption(video.description)}
          </p>
          {(expanded || isDescriptionOverflowing) && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-0.5 text-[14px] font-bold leading-[18px] text-[var(--tt-text)] hover:underline"
            >
              {expanded ? "less" : "more"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * Splits a caption so each `#hashtag` renders in the interactive blue TikTok
 * uses for mentions and tags, leaving the surrounding text untouched. Unicode
 * letter/number classes so Vietnamese tags ("#chảnh") match too.
 */
function renderCaption(text: string): React.ReactNode {
  return text.split(/(#[\p{L}\p{N}_]+)/gu).map((part, i) =>
    part.startsWith("#") ? (
      <span key={i} className="text-[var(--tt-mention)]">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
