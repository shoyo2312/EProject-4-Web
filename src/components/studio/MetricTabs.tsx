"use client";

import { useState } from "react";

import { StudioLineChart } from "@/components/studio/charts/StudioLineChart";
import { StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { formatCount } from "@/lib/format";
import { changeLine, dayLabel } from "@/lib/studio/metrics";
import { cn } from "@/lib/utils";

export interface Metric {
  key: string;
  label: string;
  value: number;
  previous?: number;
  /** One value per day, oldest first; a metric without one shows no chart. */
  series?: number[];
}

/**
 * TikTok's metric strip: one cell per metric, the picked one blue with a bar
 * on top, and the picked metric's days drawn underneath.
 */
export function MetricTabs({
  metrics,
  days,
}: {
  metrics: Metric[] | null;
  days: string[];
}) {
  const [picked, setPicked] = useState(0);
  const metric = metrics?.[Math.min(picked, metrics.length - 1)];

  return (
    <StudioCard className="overflow-hidden">
      <div className="flex">
        {(metrics ?? PLACEHOLDER).map((item, index) => {
          const active = metrics !== null && index === picked;
          return (
            <button
              key={item.key}
              type="button"
              disabled={!metrics}
              onClick={() => setPicked(index)}
              className={cn(
                "relative flex flex-1 flex-col items-center gap-1 py-5 text-center",
                active
                  ? "bg-white"
                  : "border-b border-black/12 bg-[#fcfcfc] hover:bg-white",
                index > 0 && "border-l border-black/8",
              )}
            >
              {active && (
                <span className="absolute inset-x-0 top-0 h-1 bg-[#0075db]" />
              )}
              <span className="px-5 text-[14px] leading-[18px] font-medium text-black">
                {item.label}
              </span>
              {metrics ? (
                <>
                  <span
                    className={cn(
                      "text-[24px] leading-[30px] font-medium",
                      active ? "text-[#0075db]" : "text-black",
                    )}
                  >
                    {formatCount(item.value)}
                  </span>
                  {item.previous !== undefined && (
                    <span className="text-[13px] leading-4 text-black/34">
                      {changeLine(item.value, item.previous)}
                    </span>
                  )}
                </>
              ) : (
                <StudioSkeleton className="mt-1 h-7 w-16" />
              )}
            </button>
          );
        })}
      </div>

      {metric?.series ? (
        <div className="px-6 pt-6 pb-4">
          <StudioLineChart
            points={metric.series.map((value, i) => ({ label: days[i], value }))}
            formatLabel={dayLabel}
            formatValue={formatCount}
          />
        </div>
      ) : (
        <div className="px-6 pt-6 pb-4">
          <StudioSkeleton className="h-[220px]" />
        </div>
      )}
    </StudioCard>
  );
}

const PLACEHOLDER: Metric[] = [
  "Video views",
  "Likes",
  "Comments",
  "Shares",
  "Followers",
].map((label) => ({
  key: label,
  label,
  value: 0,
}));
