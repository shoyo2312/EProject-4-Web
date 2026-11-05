import { ImageOff, Pin } from "lucide-react";
import Link from "next/link";

import type { VideoResponse, VideoStatus } from "@/lib/api/types";
import { STATUS_LABEL, STATUS_NOTE } from "@/lib/studio/overview";
import { cn } from "@/lib/utils";

/** Statuses Studio paints red: the post is gone, or never made it. */
const NEGATIVE = new Set<VideoStatus>(["REJECTED", "TAKEN_DOWN", "FAILED"]);

const DATE = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatPostDate(iso: string): string {
  return DATE.format(new Date(iso));
}

/** A post as Studio lists it: the cover, then the caption and when it went up. */
export function PostCell({
  video,
  href,
  size = "md",
  meta,
  onOpen,
}: {
  video: VideoResponse | undefined;
  href?: string;
  size?: "sm" | "md";
  /** Replaces the date line. */
  meta?: React.ReactNode;
  /** Makes the cover its own button, as on tiktokstudio — it plays the post, the caption keeps `href`. */
  onOpen?: () => void;
}) {
  const status = video ? STATUS_LABEL[video.status] : null;
  const thumb = (
    <PostThumb url={video?.thumbnailUrl ?? null} className={size === "sm" ? "h-12 w-9" : "h-[72px] w-[54px]"} />
  );
  const text = (
      <span className="flex min-w-0 flex-col gap-1">
        <span className="line-clamp-2 text-[14px] leading-[18px] font-medium text-black">
          {video?.title || video?.description || "Video unavailable"}
        </span>
        <span className="flex items-center gap-2 text-[12px] leading-4 text-black/50">
          {video?.pinnedAt && (
            // TikTok Studio's label: pink pill, filled pin, ahead of the date.
            <span className="flex h-6 flex-none items-center gap-[3px] rounded-[4px] bg-[#fe2c55]/7 px-1.5 font-medium text-[#e10543]">
              <Pin className="h-3 w-3 fill-current" strokeWidth={2} aria-hidden />
              Pinned
            </span>
          )}
          {meta ?? (video ? formatPostDate(video.createdAt) : null)}
          {status && (
            <span
              className={cn(
                "rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold",
                video && NEGATIVE.has(video.status) ? "bg-[#fe2c55]/10 text-[#d81b44]" : "bg-black/5 text-black/65",
              )}
            >
              {status}
            </span>
          )}
        </span>
      </span>
  );

  if (onOpen)
    return (
      <div className="flex min-w-0 items-center gap-3">
        <button type="button" onClick={onOpen} aria-label="Play video" className="flex-none hover:opacity-80">
          {thumb}
        </button>
        {href ? (
          <Link href={href} className="min-w-0 hover:opacity-80">
            {text}
          </Link>
        ) : (
          text
        )}
      </div>
    );

  return href ? (
    <Link href={href} className="flex min-w-0 items-center gap-3 hover:opacity-80">
      {thumb}
      {text}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">
      {thumb}
      {text}
    </div>
  );
}

export function PostThumb({ url, className }: { url: string | null; className?: string }) {
  // flex, not the span's default inline: an inline box ignores width and height, so the cover
  // rendered at the image's own size wherever the parent was not a flex row. flex rather than
  // block also centres the placeholder icon.
  return (
    <span className={cn("flex flex-none items-center justify-center overflow-hidden rounded-[4px] bg-black/8", className)}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, as in ActivityDrawer
        <img src={url} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageOff className="h-4 w-4 text-black/25" aria-hidden />
      )}
    </span>
  );
}

/** Why a post is not live, above its edit and analytics pages. Nothing for a live post. */
export function StatusNote({ status }: { status: VideoStatus }) {
  const note = STATUS_NOTE[status];
  if (!note) return null;
  return (
    <p
      role="status"
      className={cn(
        "rounded-[8px] px-4 py-3 text-[14px] leading-5",
        NEGATIVE.has(status) ? "bg-[#fe2c55]/10 text-[#d81b44]" : "bg-black/5 text-black/75",
      )}
    >
      {note}
    </p>
  );
}
