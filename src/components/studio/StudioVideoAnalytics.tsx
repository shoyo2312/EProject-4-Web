"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { MetricTabs } from "@/components/studio/MetricTabs";
import { PostCell } from "@/components/studio/PostCell";
import { useStudioRange } from "@/components/studio/StudioRange";
import { EmptyState, RangeSelect, SectionTitle, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { getCreatorVideo } from "@/lib/api/studio";
import { getVideo } from "@/lib/api/videos";
import { formatCount, formatDuration } from "@/lib/format";
import { formatPercent, formatWatchTime, linePath } from "@/lib/studio/metrics";

const CHART_W = 1000;
const CHART_H = 200;

/**
 * `/studio/analytics/{videoId}` — one post: lifetime totals, how far people
 * watched, and its days in the picked window. Someone else's video answers 404,
 * so it reads as "not found" here too.
 */
export function StudioVideoAnalytics({ videoId }: { videoId: string }) {
  const { days, setDays } = useStudioRange();
  const video = useStudioQuery(`video:${videoId}`, (signal) => getVideo(videoId, signal));
  const stats = useStudioQuery(`video-stats:${videoId}:${days}`, (signal) => getCreatorVideo(videoId, days, signal));
  const data = stats.data;

  const sum = (pick: (day: { views: number; likes: number; comments: number; shares: number }) => number) =>
    data?.daily.reduce((total, day) => total + pick(day), 0) ?? 0;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/studio/content"
            aria-label="Back to posts"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-black/5"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
          <PostCell video={video.data ?? undefined} href={`/video/${videoId}`} />
        </div>
        <RangeSelect days={days} onChange={setDays} />
      </div>

      {stats.error ? (
        <StudioCard>
          <EmptyState>{stats.error}</EmptyState>
        </StudioCard>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <SectionTitle>Overview</SectionTitle>
            <StudioCard className="grid grid-cols-4 divide-x divide-black/8">
              {[
                ["Video views", data && formatCount(data.views)],
                ["Total play time", data && formatWatchTime(data.totalWatchMs)],
                ["Average watch time", data && formatWatchTime(data.avgWatchMs)],
                ["Watched full video", data && formatPercent(data.completionRate)],
              ].map(([label, value]) => (
                <div key={label} className="flex flex-col items-center gap-1 py-5">
                  <span className="text-[14px] leading-[18px] font-medium">{label}</span>
                  {value ? (
                    <span className="text-[24px] leading-[30px] font-medium">{value}</span>
                  ) : (
                    <StudioSkeleton className="h-7 w-16" />
                  )}
                </div>
              ))}
            </StudioCard>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle>Retention rate</SectionTitle>
            <StudioCard className="px-6 pt-6 pb-4">
              {!data ? (
                <StudioSkeleton className="h-[200px]" />
              ) : data.views === 0 ? (
                <EmptyState>No views yet</EmptyState>
              ) : (
                <RetentionChart points={data.retention} durationSeconds={video.data?.durationSeconds ?? null} />
              )}
            </StudioCard>
          </section>

          <section className="flex flex-col gap-4">
            <SectionTitle>Engagement in the last {days} days</SectionTitle>
            <MetricTabs
              metrics={
                data && [
                  { key: "views", label: "Video views", value: sum((d) => d.views), series: data.daily.map((d) => d.views) },
                  { key: "likes", label: "Likes", value: sum((d) => d.likes), series: data.daily.map((d) => d.likes) },
                  { key: "comments", label: "Comments", value: sum((d) => d.comments), series: data.daily.map((d) => d.comments) },
                  { key: "shares", label: "Shares", value: sum((d) => d.shares), series: data.daily.map((d) => d.shares) },
                ]
              }
              days={data?.daily.map((d) => d.day) ?? []}
            />
          </section>
        </>
      )}
    </div>
  );
}

/** Share of views still watching at each 5% of the video, with times under it when the length is known. */
function RetentionChart({ points, durationSeconds }: { points: number[]; durationSeconds: number | null }) {
  const marks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="h-[200px] w-full overflow-visible">
          {[0, 0.5, 1].map((share) => (
            <line
              key={share}
              x1={0}
              x2={CHART_W}
              y1={CHART_H * share}
              y2={CHART_H * share}
              stroke="rgba(0,0,0,0.12)"
              strokeDasharray={share === 1 ? undefined : "4 4"}
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path
            d={linePath(points, CHART_W, CHART_H, 1)}
            fill="none"
            stroke="#0075db"
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="mt-2 flex justify-between text-[12px] leading-4 text-black/50">
          {marks.map((mark) => (
            <span key={mark}>
              {durationSeconds ? formatDuration(durationSeconds * mark) : `${mark * 100}%`}
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-[200px] w-10 flex-none flex-col justify-between text-[12px] leading-none text-black/34">
        <span>100%</span>
        <span>50%</span>
        <span>0%</span>
      </div>
    </div>
  );
}
