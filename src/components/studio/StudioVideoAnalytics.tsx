"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";

import { StudioLineChart } from "@/components/studio/charts/StudioLineChart";
import { MetricTabs } from "@/components/studio/MetricTabs";
import { PostCell, StatusNote } from "@/components/studio/PostCell";
import { useStudioRange } from "@/components/studio/StudioRange";
import { useOpenStudioVideo } from "@/components/studio/StudioVideoModal";
import { EmptyState, RangeSelect, SectionTitle, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { SearchQueries } from "@/components/studio/video/SearchQueries";
import { TrafficSources } from "@/components/studio/video/TrafficSources";
import { ViewerBreakdown } from "@/components/studio/video/ViewerBreakdown";
import { BookmarkIcon, CommentIcon, HeartIcon, PlayIcon, ShareIcon } from "@/components/icons";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { getVideoCounts } from "@/lib/api/interactions";
import { getCreatorVideo } from "@/lib/api/studio";
import { getVideo } from "@/lib/api/videos";
import { formatCount, formatDuration } from "@/lib/format";
import { formatPercent, formatWatchTime, retentionInsight } from "@/lib/studio/metrics";

/**
 * `/studio/analytics/{videoId}` — one post: lifetime totals, how far people
 * watched, and its days in the picked window. Someone else's video answers 404,
 * so it reads as "not found" here too.
 */
export function StudioVideoAnalytics({ videoId }: { videoId: string }) {
  const openVideo = useOpenStudioVideo();
  const { days, setDays } = useStudioRange();
  const video = useStudioQuery(`video:${videoId}`, (signal) => getVideo(videoId, signal));
  const stats = useStudioQuery(`video-stats:${videoId}:${days}`, (signal) => getCreatorVideo(videoId, days, signal));
  const data = stats.data;

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
          <PostCell video={video.data ?? undefined} onOpen={() => openVideo(videoId)} />
        </div>
        <VideoCounts videoId={videoId} />
      </div>

      {video.data && <StatusNote status={video.data.status} />}

      {/* A failed upload never had a viewer: the note above is the whole story. */}
      {video.data?.status === "FAILED" ? null : stats.error ? (
        <StudioCard>
          <EmptyState>{stats.error}</EmptyState>
        </StudioCard>
      ) : (
        <>
          <section className="flex flex-col gap-4">
            <SectionTitle>Overview</SectionTitle>
            <StudioCard className="grid grid-cols-5 divide-x divide-black/8">
              {[
                ["Video views", data && formatCount(data.views)],
                ["Total play time", data && formatWatchTime(data.totalWatchMs)],
                ["Average watch time", data && formatWatchTime(data.avgWatchMs)],
                ["Watched full video", data && formatPercent(data.completionRate)],
                ["New followers", data && formatCount(data.newFollowers)],
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
            {/* Only this section follows the range: the totals above are lifetime. */}
            <div className="flex items-center justify-between">
              <SectionTitle>Engagement</SectionTitle>
              <RangeSelect days={days} onChange={setDays} />
            </div>
            <MetricTabs
              metrics={
                data &&
                (
                  [
                    ["views", "Video views"],
                    ["likes", "Likes"],
                    ["comments", "Comments"],
                    ["shares", "Shares"],
                    ["saves", "Saves"],
                  ] as const
                ).map(([key, label]) => ({
                  key,
                  label,
                  value: data.current[key],
                  previous: data.previous[key],
                  series: data.daily.map((d) => d[key]),
                }))
              }
              days={data?.daily.map((d) => d.day) ?? []}
            />
          </section>

          {data && (
            <>
              <ViewerBreakdown viewers={data.audience} />
              <div className="grid grid-cols-2 gap-6">
                <TrafficSources rows={data.trafficSources} />
                <SearchQueries rows={data.searchQueries} />
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

/** Lifetime counters beside the post, as TikTok Studio shows them. Saves live only in interaction-service. */
function VideoCounts({ videoId }: { videoId: string }) {
  const query = useStudioQuery(`video-counts:${videoId}`, (signal) =>
    getVideoCounts([videoId], signal).then(([row]) => row),
  );
  const counts = query.data;
  if (query.error) return null;

  return (
    <dl className="flex flex-none items-center gap-6">
      {(
        [
          ["Views", PlayIcon, counts?.viewCount],
          ["Likes", HeartIcon, counts?.likeCount],
          ["Comments", CommentIcon, counts?.commentCount],
          ["Shares", ShareIcon, counts?.shareCount],
          ["Saves", BookmarkIcon, counts?.saveCount],
        ] as const
      ).map(([label, Icon, value]) => (
        <div key={label} className="flex w-[52px] flex-col items-center gap-1" title={label}>
          <dt>
            <Icon aria-hidden className="h-5 w-5 text-black/24" />
            <span className="sr-only">{label}</span>
          </dt>
          <dd className="text-[14px] leading-5 text-black/65">
            {value === undefined ? <StudioSkeleton className="h-4 w-6" /> : formatCount(value)}
          </dd>
        </div>
      ))}
    </dl>
  );
}

/**
 * Share of views still watching at each 5% of the video, with times under it
 * when the length is known, and under that where most people left.
 */
function RetentionChart({ points, durationSeconds }: { points: number[]; durationSeconds: number | null }) {
  const mark = (i: number) => (durationSeconds ? formatDuration((durationSeconds * i) / 20) : `${i * 5}%`);
  const insight = retentionInsight(points);

  return (
    <div className="flex flex-col gap-3">
      <StudioLineChart
        points={points.map((value, i) => ({ label: String(i), value }))}
        height={200}
        yDomain={[0, 1]}
        formatLabel={(_, i) => mark(i)}
        formatValue={(value) => `${Math.round(value * 100)}% still watching`}
      />
      {insight !== null && (
        <p className="text-[14px] leading-5 text-black/65">
          {insight === 1
            ? "Most viewers left in the first few seconds."
            : `Most viewers stopped watching at ${mark(insight)}.`}
        </p>
      )}
    </div>
  );
}
