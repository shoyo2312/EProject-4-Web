"use client";

import { SquareActivity } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { MetricTabs } from "@/components/studio/MetricTabs";
import { formatPostDate, PostCell } from "@/components/studio/PostCell";
import { useStudioRange } from "@/components/studio/StudioRange";
import { EmptyState, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { getCreatorOverview, getCreatorTopVideos, getCreatorViewers } from "@/lib/api/studio";
import type { CreatorVideoSort, CreatorVideoStats } from "@/lib/api/types";
import { getVideosByIds } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { niceMax } from "@/lib/studio/metrics";
import { overviewMetrics } from "@/lib/studio/overview";
import { cn } from "@/lib/utils";

/** `/studio/analytics` — the metric strip and its chart, for the range in the header. */
export function AnalyticsOverview() {
  const { days } = useStudioRange();
  const overview = useStudioQuery(`overview:${days}`, (signal) => getCreatorOverview(days, signal));

  return overview.error ? (
    <StudioCard>
      <EmptyState>{overview.error}</EmptyState>
    </StudioCard>
  ) : (
    <MetricTabs
      metrics={overview.data && overviewMetrics(overview.data)}
      days={overview.data?.daily.map((d) => d.day) ?? []}
    />
  );
}

const TOP_TABS: { sort: CreatorVideoSort; label: string; column: string; pick: (row: CreatorVideoStats) => number }[] = [
  { sort: "VIEWS", label: "Most views", column: "Views", pick: (row) => row.views },
  { sort: "NEW_VIEWERS", label: "Most new viewers", column: "New viewers", pick: (row) => row.newViewers },
  { sort: "LIKES", label: "Most likes", column: "Likes", pick: (row) => row.likes },
];

const TOP_GRID = "grid grid-cols-[minmax(0,1fr)_200px_140px_140px_80px] items-center gap-4";

/** `/studio/analytics/content` — "Your top posts", one tab per ranking. */
export function AnalyticsContent() {
  const { days } = useStudioRange();
  const [tab, setTab] = useState(0);
  const { sort, column, pick } = TOP_TABS[tab];

  const top = useStudioQuery(`top:${days}:${sort}`, async (signal) => {
    const rows = await getCreatorTopVideos(days, sort, 10, signal);
    const videos = await getVideosByIds(rows.map((row) => row.videoId), signal);
    return { rows, videos: new Map(videos.map((video) => [video.id, video])) };
  });

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-[20px] leading-6 font-bold">Your top posts</h1>
      <StudioCard>
        <div className="flex gap-6 border-b border-black/8 px-5">
          {TOP_TABS.map((item, index) => (
            <button
              key={item.sort}
              type="button"
              onClick={() => setTab(index)}
              className={cn(
                "h-[54px] border-b-2 text-[14px] font-medium transition-colors",
                index === tab ? "border-black text-black" : "border-transparent text-black/50 hover:text-black/65",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className={cn(TOP_GRID, "border-b border-black/8 px-5 py-3 text-[13px] text-black/50")}>
          <span className="pl-11">Post</span>
          <span>
            {column} in last {days} days
          </span>
          <span>Total views</span>
          <span>Posted on</span>
          <span className="text-center">Actions</span>
        </div>

        {top.error ? (
          <EmptyState>{top.error}</EmptyState>
        ) : !top.data ? (
          <div className="flex flex-col gap-3 p-5">
            <StudioSkeleton className="h-[72px]" />
            <StudioSkeleton className="h-[72px]" />
          </div>
        ) : top.data.rows.length === 0 ? (
          <p className="py-40 text-center text-[16px] font-semibold">No top posts yet</p>
        ) : (
          <ol className="divide-y divide-black/8">
            {top.data.rows.map((row, index) => {
              const video = top.data!.videos.get(row.videoId);
              return (
                <li key={row.videoId} className={cn(TOP_GRID, "px-5 py-4 text-[14px]")}>
                  <div className="flex min-w-0 items-center gap-4">
                    <span className="w-7 flex-none text-center text-[16px] font-semibold text-black/50">{index + 1}</span>
                    <PostCell video={video} href={`/studio/analytics/${row.videoId}`} meta={null} />
                  </div>
                  <span className="font-semibold">{formatCount(pick(row))}</span>
                  <span>{video ? formatCount(video.viewCount) : "–"}</span>
                  <span>{video ? formatPostDate(video.createdAt) : "–"}</span>
                  <Link
                    href={`/studio/analytics/${row.videoId}`}
                    aria-label="Analytics"
                    className="mx-auto flex h-8 w-8 items-center justify-center rounded-[4px] hover:bg-black/5"
                  >
                    <SquareActivity className="h-4 w-4" />
                  </Link>
                </li>
              );
            })}
          </ol>
        )}
      </StudioCard>
    </div>
  );
}

const HOURS = Array.from({ length: 24 }, (_, hour) => `${hour}`);
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** `/studio/analytics/viewers` — totals, then when they watch once there are enough of them. */
export function AnalyticsViewers() {
  const { days } = useStudioRange();
  const viewers = useStudioQuery(`viewers:${days}`, (signal) => getCreatorViewers(days, signal));
  const [byDay, setByDay] = useState(false);
  const data = viewers.data;

  if (viewers.error) {
    return (
      <StudioCard>
        <EmptyState>{viewers.error}</EmptyState>
      </StudioCard>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <MetricTabs
        metrics={
          data && [
            { key: "total", label: "Total viewers", value: data.totalViewers, previous: data.previousTotalViewers },
            { key: "new", label: "New viewers", value: data.newViewers, previous: data.previousNewViewers },
          ]
        }
        days={[]}
      />

      <StudioCard>
        <h2 className="border-b border-black/8 px-5 py-4 text-[16px] leading-5 font-medium">Most active times</h2>
        <div className="p-5">
          {!data ? (
            <StudioSkeleton className="h-[220px]" />
          ) : !data.breakdownAvailable || !data.activeHours || !data.activeDays ? (
            <p className="text-[14px] text-black/65">
              You&apos;ll be able to see this once you have enough viewers to analyze.
            </p>
          ) : (
            <>
              <div className="mb-4 flex gap-2">
                {["Hours", "Days"].map((label, index) => {
                  const active = byDay === (index === 1);
                  return (
                    <button
                      key={label}
                      type="button"
                      onClick={() => setByDay(index === 1)}
                      className={cn(
                        "h-7 rounded-[4px] px-3 text-[14px] font-medium",
                        active ? "bg-[#0075db]/10 text-[#0075db]" : "bg-black/5 text-black/50 hover:text-black/65",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <BarChart
                values={byDay ? data.activeDays : data.activeHours}
                labels={byDay ? WEEKDAYS : HOURS}
              />
            </>
          )}
        </div>
      </StudioCard>
    </div>
  );
}

/** Viewers per bucket, as TikTok's active-times chart: blue bars over three gridlines. */
function BarChart({ values, labels }: { values: number[]; labels: string[] }) {
  const max = Math.max(2, niceMax(Math.max(0, ...values)));

  return (
    <div className="flex gap-3">
      <div className="min-w-0 flex-1">
        <div className="relative flex h-[220px] items-end gap-1 border-b border-black/12">
          <span className="absolute inset-x-0 top-0 border-t border-dashed border-black/12" />
          <span className="absolute inset-x-0 top-1/2 border-t border-dashed border-black/12" />
          {values.map((value, index) => (
            <div key={labels[index]} className="flex h-full flex-1 items-end" title={`${labels[index]}: ${value}`}>
              <svg viewBox="0 0 10 100" preserveAspectRatio="none" className="h-full w-full">
                <rect x={1} y={100 - (value / max) * 100} width={8} height={(value / max) * 100} rx={1} fill="#0075db" />
              </svg>
            </div>
          ))}
        </div>
        <div className="mt-2 flex gap-1 text-[12px] text-black/50">
          {labels.map((label) => (
            <span key={label} className="flex-1 text-center">
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="flex h-[220px] w-10 flex-none flex-col justify-between text-[12px] leading-none text-black/34">
        <span>{formatCount(max)}</span>
        <span>{formatCount(max / 2)}</span>
        <span>0</span>
      </div>
    </div>
  );
}
