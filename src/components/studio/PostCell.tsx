import Link from "next/link";

import type { VideoResponse } from "@/lib/api/types";
import { STATUS_LABEL } from "@/lib/studio/overview";
import { cn } from "@/lib/utils";

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
}: {
  video: VideoResponse | undefined;
  href?: string;
  size?: "sm" | "md";
  /** Replaces the date line. */
  meta?: React.ReactNode;
}) {
  const status = video ? STATUS_LABEL[video.status] : null;
  const body = (
    <>
      <PostThumb url={video?.thumbnailUrl ?? null} className={size === "sm" ? "h-12 w-9" : "h-[72px] w-[54px]"} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="line-clamp-2 text-[14px] leading-[18px] font-medium text-black">
          {video?.title || video?.description || "Video unavailable"}
        </span>
        <span className="flex items-center gap-2 text-[12px] leading-4 text-black/50">
          {meta ?? (video ? formatPostDate(video.createdAt) : null)}
          {status && (
            <span
              className={cn(
                "rounded-[4px] px-1.5 py-0.5 text-[11px] font-semibold",
                video?.status === "REJECTED" || video?.status === "TAKEN_DOWN" || video?.status === "FAILED"
                  ? "bg-[#fe2c55]/10 text-[#d81b44]"
                  : "bg-black/5 text-black/65",
              )}
            >
              {status}
            </span>
          )}
        </span>
      </span>
    </>
  );

  return href ? (
    <Link href={href} className="flex min-w-0 items-center gap-3 hover:opacity-80">
      {body}
    </Link>
  ) : (
    <div className="flex min-w-0 items-center gap-3">{body}</div>
  );
}

export function PostThumb({ url, className }: { url: string | null; className?: string }) {
  return (
    <span className={cn("flex-none overflow-hidden rounded-[4px] bg-black/8", className)}>
      {url && (
        // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, as in ActivityDrawer
        <img src={url} alt="" className="h-full w-full object-cover" />
      )}
    </span>
  );
}
