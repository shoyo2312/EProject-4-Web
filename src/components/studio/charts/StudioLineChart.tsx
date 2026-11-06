"use client";

import { useId } from "react";
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis } from "recharts";

import { ChartContainer } from "@/components/ui/chart";
import { labelIndexes, niceMax } from "@/lib/studio/metrics";

export interface ChartPoint {
  label: string;
  value: number;
}

const BLUE = "#0075db";

/**
 * Studio's line chart, the way TikTok draws one: a 2px blue line over a fading
 * blue fill, three gridlines (0, half, top) labelled on the right, a few labels
 * under the x axis, and on hover a dashed cursor, a ringed dot, and a card with
 * the label over the value.
 *
 * `formatTick` is the y axis's own format when the tooltip's `formatValue` is
 * too long for a 48px column; it defaults to `formatValue`.
 * `width` is only for tests: in the page the chart fills its container.
 */
export function StudioLineChart({
  points,
  formatValue = (value) => String(value),
  formatTick = formatValue,
  formatLabel = (label) => label,
  height = 220,
  yDomain,
  width,
}: {
  points: ChartPoint[];
  formatValue?: (value: number) => string;
  formatTick?: (value: number) => string;
  formatLabel?: (label: string, index: number) => string;
  height?: number;
  yDomain?: [number, number];
  width?: number;
}) {
  const gradient = `studio-area-${useId().replace(/:/g, "")}`;
  const min = yDomain?.[0] ?? 0;
  // At least 2, so the middle gridline is a whole number.
  const max = yDomain?.[1] ?? Math.max(2, niceMax(Math.max(0, ...points.map((p) => p.value))));
  const indexOf = new Map(points.map((p, i) => [p.label, i]));
  const ticks = labelIndexes(points.length).map((i) => points[i].label);

  return (
    <ChartContainer
      config={{ value: { color: BLUE } }}
      className="aspect-auto w-full"
      style={{ height }}
      initialDimension={{ width: width ?? 320, height }}
    >
      <AreaChart data={points} margin={{ top: 8, right: 0, bottom: 0, left: 8 }}>
        <defs>
          <linearGradient id={gradient} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={BLUE} stopOpacity={0.18} />
            <stop offset="100%" stopColor={BLUE} stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="rgba(0,0,0,0.12)" strokeDasharray="4 4" />
        <XAxis
          dataKey="label"
          ticks={ticks}
          interval={0}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "rgba(0,0,0,0.5)", fontSize: 12 }}
          tickFormatter={(label: string) => formatLabel(label, indexOf.get(label) ?? 0)}
        />
        <YAxis
          orientation="right"
          domain={[min, max]}
          ticks={[min, (min + max) / 2, max]}
          width={48}
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fill: "rgba(0,0,0,0.34)", fontSize: 12 }}
          tickFormatter={(value: number) => formatTick(value)}
        />
        <Tooltip
          cursor={{ stroke: "rgba(0,0,0,0.3)", strokeDasharray: "4 4" }}
          isAnimationActive={false}
          content={({ active, payload }) => {
            const point = payload?.[0]?.payload as ChartPoint | undefined;
            if (!active || !point) return null;
            return (
              <div className="rounded-[8px] border border-black/8 bg-white px-3 py-2 shadow-[0_2px_8px_rgba(0,0,0,0.12)]">
                <div className="text-[12px] leading-4 text-black/50">
                  {formatLabel(point.label, indexOf.get(point.label) ?? 0)}
                </div>
                <div className="text-[14px] leading-[18px] font-semibold text-black">
                  {formatValue(point.value)}
                </div>
              </div>
            );
          }}
        />
        <Area
          type="linear"
          dataKey="value"
          stroke={BLUE}
          strokeWidth={2}
          fill={`url(#${gradient})`}
          dot={false}
          activeDot={{ r: 4, fill: "#fff", stroke: BLUE, strokeWidth: 2 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ChartContainer>
  );
}
