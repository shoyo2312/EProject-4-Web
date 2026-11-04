"use client";

import { useState } from "react";

import { StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { formatCount } from "@/lib/format";
import { changeLine, dayLabel, labelIndexes, linePath, niceMax } from "@/lib/studio/metrics";
import { cn } from "@/lib/utils";

export interface Metric {
  key: string;
  label: string;
  value: number;
  previous?: number;
  /** One value per day, oldest first; a metric without one shows no chart. */
  series?: number[];
}

const CHART_W = 1000;
const CHART_H = 220;
const BLUE = "#0075db";

/**
 * TikTok's metric strip: one cell per metric, the picked one blue with a bar
 * on top, and the picked metric's days drawn underneath.
 */
export function MetricTabs({ metrics, days }: { metrics: Metric[] | null; days: string[] }) {
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
                active ? "bg-white" : "border-b border-black/12 bg-[#fcfcfc] hover:bg-white",
                index > 0 && "border-l border-black/8",
              )}
            >
              {active && <span className="absolute inset-x-0 top-0 h-1 bg-[#0075db]" />}
              <span className="px-5 text-[14px] leading-[18px] font-medium text-black">{item.label}</span>
              {metrics ? (
                <>
                  <span
                    className={cn("text-[24px] leading-[30px] font-medium", active ? "text-[#0075db]" : "text-black")}
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

      {metric?.series && <LineChart values={metric.series} days={days} />}
    </StudioCard>
  );
}

const PLACEHOLDER: Metric[] = ["Video views", "Likes", "Comments", "Shares", "Followers"].map((label) => ({
  key: label,
  label,
  value: 0,
}));

/** The picked metric over the window: gridlines, the line, and day labels under it. */
export function LineChart({ values, days }: { values: number[]; days: string[] }) {
  // At least 2, so the middle gridline is a whole number.
  const max = Math.max(2, niceMax(Math.max(0, ...values)));
  const labels = labelIndexes(days.length);

  return (
    <div className="px-6 pt-6 pb-4">
      <div className="flex gap-3">
        <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="h-[220px] min-w-0 flex-1 overflow-visible">
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
            d={linePath(values, CHART_W, CHART_H, max)}
            fill="none"
            stroke={BLUE}
            strokeWidth={2}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="flex h-[220px] w-10 flex-none flex-col justify-between text-[12px] leading-none text-black/34">
          <span>{formatCount(max)}</span>
          <span>{formatCount(max / 2)}</span>
          <span>0</span>
        </div>
      </div>
      <div className="mt-2 mr-[52px] flex justify-between text-[12px] leading-4 text-black/50">
        {labels.map((index) => (
          <span key={index} className="whitespace-nowrap">
            {dayLabel(days[index])}
          </span>
        ))}
      </div>
    </div>
  );
}
