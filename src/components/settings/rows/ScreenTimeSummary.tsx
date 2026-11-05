"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { CheckIcon, InfoCircleIcon, TriangleDownIcon } from "@/components/icons";
import { useSession } from "@/components/session/SessionProvider";
import { ExpandRow } from "@/components/settings/rows/parts";
import { toast } from "@/components/ui/toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useDismiss } from "@/hooks/use-dismiss";
import { messageFor } from "@/lib/api/errors";
import {
  getScreenTimeWeek,
  type ScreenTimeDay,
  type ScreenTimeWeekResponse,
} from "@/lib/api/screen-time";
import {
  axisTicks,
  axisTop,
  formatDuration,
  lastFourWeeks,
} from "@/lib/settings/screen-time";
import { cn } from "@/lib/utils";
import type { SettingsRow } from "@/types/tiktok";

/** Day time sits under night time in each bar; the live chart's colours. */
const DAY_COLOR = "#20D5EC";
const NIGHT_COLOR = "#10A2C5";
const NIGHT_HOVER_COLOR = "rgb(18 178 217)";
const AXIS_COLOR = "#6E748E";
const GRID_COLOR = "#E0E2EB";

/** The live chart's box and plot, in CSS px. */
const CHART_WIDTH = 379;
const CHART_HEIGHT = 294;
const PLOT_LEFT = 72;
const PLOT_RIGHT = 354;
const PLOT_TOP = 24;
const BASELINE = 248;
const PLOT_HEIGHT = BASELINE - PLOT_TOP;
const SLOT = (PLOT_RIGHT - PLOT_LEFT) / 7;
const BAR_WIDTH = 32;
const TIP_WIDTH = 91;
const TIP_HEIGHT = 68;
/** A legend bar at a 100% share. */
const LEGEND_BAR_WIDTH = 125;

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type Week = { start: string; label: string };

/**
 * Screen time → Summary: the time spent on the site each day of a week, day
 * time under night time, for any of the last four weeks. Laid out as the live
 * page lays it out (`docs/research/tiktok.com/SETTINGS.md`); the chart is plain
 * SVG rather than a charting library.
 */
export function ScreenTimeSummaryRow({
  row,
  expanded,
  onToggle,
  week = null,
}: {
  row: SettingsRow;
  expanded: boolean;
  onToggle: () => void;
  /** The Monday a weekly update linked to, opened instead of this week when offered. */
  week?: string | null;
}) {
  const { requireSignIn } = useSession();

  return (
    <ExpandRow
      row={row}
      expanded={expanded}
      // The chart is the account's own time: signed out, there is none to read.
      onToggle={() => {
        if (expanded || requireSignIn()) onToggle();
      }}
    >
      <WeekSummary key={week ?? "current"} linked={week} />
    </ExpandRow>
  );
}

function WeekSummary({ linked }: { linked: string | null }) {
  // Mounted only while the row is open, so "now" is when it was opened.
  const [weeks] = useState(() => lastFourWeeks(new Date()));
  const [selected, setSelected] = useState(
    () => weeks.find((offered) => offered.start === linked) ?? weeks[weeks.length - 1],
  );
  const [week, setWeek] = useState<ScreenTimeWeekResponse | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScreenTimeWeek(selected.start).then(
      (value) => {
        if (!cancelled) setWeek(value);
      },
      (cause) => {
        if (!cancelled) toast.error(messageFor(cause));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [selected.start]);

  // Never the previous week's bars under the new week's name.
  const days = week?.weekStart === selected.start ? week.days : null;

  return (
    <div className="p-6">
      <p className="text-[16px] leading-6 font-medium text-[var(--tt-text)]">Select week</p>
      <WeekPicker weeks={weeks} selected={selected} onSelect={setSelected} />

      <div role="tablist" className="mt-[23px] border-b border-[var(--tt-divider)]">
        <button
          type="button"
          role="tab"
          aria-selected="true"
          className="relative ms-6 h-10 px-2.5 text-[14px] text-[var(--tt-text)]"
        >
          Time spent
          <span className="absolute inset-x-0 bottom-0 h-0.5 bg-[rgb(255_255_255/0.9)]" />
        </button>
      </div>

      <div role="tabpanel" className="mt-5 flex">
        {days ? (
          <>
            <WeekChart weekStart={selected.start} days={days} />
            <Legend days={days} />
          </>
        ) : (
          <SummarySkeleton />
        )}
      </div>
    </div>
  );
}

/**
 * Stands in for the chart and legend until the week is read. An empty chart
 * would read as "no time at all" for as long as the server takes to answer.
 */
function SummarySkeleton() {
  return (
    <div role="status" aria-label="Loading screen time" className="flex">
      <div
        className="flex flex-none items-end gap-[8px] pb-[46px]"
        style={{ width: CHART_WIDTH, height: CHART_HEIGHT, paddingLeft: PLOT_LEFT - BAR_WIDTH / 2 }}
      >
        {[96, 64, 144, 112, 48, 80, 128].map((height, index) => (
          <Skeleton key={index} className="w-8" style={{ height }} />
        ))}
      </div>
      <div className="ms-2.5 w-[243px] pt-[34px]">
        {[0, 1].map((index) => (
          <div key={index} className="h-[87px]">
            <Skeleton className="h-[17px] w-20" />
            <Skeleton className="my-[5px] h-1.5 w-[125px]" />
            <Skeleton className="h-[17px] w-12" />
          </div>
        ))}
        <Skeleton className="h-[17px] w-24" />
      </div>
    </div>
  );
}

function WeekPicker({
  weeks,
  selected,
  onSelect,
}: {
  weeks: Week[];
  selected: Week;
  onSelect: (week: Week) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative mt-1.5 w-[300px]">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex h-12 w-full items-center gap-2 rounded-[4px] border border-[rgb(255_255_255/0.12)] bg-[#121212] ps-[11px] pe-3 text-left text-[16px] leading-6 text-[rgb(255_255_255/0.9)]"
      >
        <span className="min-w-0 flex-1 truncate">{selected.label}</span>
        <TriangleDownIcon className="h-4 w-4 flex-none" />
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Select week"
          className="absolute top-full left-0 z-10 mt-1 w-full rounded-[4px] border border-[rgb(255_255_255/0.12)] bg-[rgb(37,37,37)] py-px shadow-[0_2px_12px_rgb(0_0_0/0.12)]"
        >
          {weeks.map((week) => {
            const checked = week.start === selected.start;
            return (
              <button
                key={week.start}
                type="button"
                role="option"
                aria-selected={checked}
                onClick={() => {
                  onSelect(week);
                  setOpen(false);
                }}
                className={cn(
                  "flex h-[42px] w-full items-center gap-2 px-[11px] text-left text-[16px] leading-6 text-[rgb(255_255_255/0.9)] hover:bg-white/[0.04]",
                  checked && "bg-white/[0.04]",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{week.label}</span>
                {checked && <CheckIcon className="h-4 w-4 flex-none" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function WeekChart({ weekStart, days }: { weekStart: string; days: ScreenTimeDay[] | null }) {
  const [hovered, setHovered] = useState<number | null>(null);
  const max = Math.max(0, ...(days ?? []).map((day) => day.daySeconds + day.nightSeconds));
  const top = axisTop(max);
  const ticks = axisTicks(max);
  const height = (seconds: number) => (top > 0 ? (seconds / top) * PLOT_HEIGHT : 0);
  const centre = (index: number) => PLOT_LEFT + SLOT * (index + 0.5);
  const [year, month, monday] = weekStart.split("-").map(Number);
  const hoveredDay = hovered === null ? undefined : days?.[hovered];

  return (
    <svg
      width={CHART_WIDTH}
      height={CHART_HEIGHT}
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label="Time spent each day"
      className="flex-none"
    >
      {ticks.map((tick, index) => {
        const y = PLOT_TOP + (index * PLOT_HEIGHT) / ticks.length;
        return (
          <g key={index}>
            <line x1={PLOT_LEFT} x2={PLOT_RIGHT} y1={y + 0.5} y2={y + 0.5} stroke={GRID_COLOR} />
            <AxisLabel y={y}>{`${tick.toFixed(1)}m`}</AxisLabel>
          </g>
        );
      })}
      <line
        x1={PLOT_LEFT}
        x2={PLOT_RIGHT}
        y1={BASELINE + 0.5}
        y2={BASELINE + 0.5}
        stroke={AXIS_COLOR}
      />
      <AxisLabel y={BASELINE}>0.0m</AxisLabel>

      {WEEKDAYS.map((weekday, index) => {
        const x = centre(index);
        const day = days?.[index];
        const dayHeight = height(day?.daySeconds ?? 0);
        const nightHeight = height(day?.nightSeconds ?? 0);
        const active = hovered === index;
        return (
          <g
            key={weekday}
            data-day={weekday}
            onMouseEnter={() => setHovered(index)}
            onMouseLeave={() => setHovered(null)}
          >
            <rect
              x={x - SLOT / 2 - 1}
              y={PLOT_TOP}
              width={SLOT + 2}
              height={PLOT_HEIGHT}
              fill={active ? "rgb(222 225 235 / 0.3)" : "transparent"}
            />
            {dayHeight > 0 && (
              <rect
                x={x - BAR_WIDTH / 2}
                y={BASELINE - dayHeight}
                width={BAR_WIDTH}
                height={dayHeight}
                fill={DAY_COLOR}
              />
            )}
            {nightHeight > 0 && (
              <rect
                x={x - BAR_WIDTH / 2}
                y={BASELINE - dayHeight - nightHeight}
                width={BAR_WIDTH}
                height={nightHeight}
                fill={active ? NIGHT_HOVER_COLOR : NIGHT_COLOR}
              />
            )}
            <text x={x} y={BASELINE + 14} textAnchor="middle" fontSize={10} fill={AXIS_COLOR}>
              {weekday}
            </text>
            <text x={x} y={BASELINE + 26} textAnchor="middle" fontSize={10} fill={AXIS_COLOR}>
              {new Date(year, month - 1, monday + index).getDate()}
            </text>
          </g>
        );
      })}

      {hovered !== null && hoveredDay && (
        <foreignObject
          x={Math.min(Math.max(centre(hovered) - TIP_WIDTH / 2, 0), CHART_WIDTH - TIP_WIDTH)}
          y={PLOT_TOP + PLOT_HEIGHT / 2}
          width={TIP_WIDTH}
          height={TIP_HEIGHT}
          pointerEvents="none"
        >
          <div className="h-full rounded-[6px] bg-[rgb(107,112,117)] p-2 text-[14px] leading-[26px] text-white shadow-[0_8px_16px_rgb(29_42_68/0.12)]">
            <p>Day: {formatDuration(hoveredDay.daySeconds)}</p>
            <p>Night: {formatDuration(hoveredDay.nightSeconds)}</p>
          </div>
        </foreignObject>
      )}
    </svg>
  );
}

function AxisLabel({ y, children }: { y: number; children: string }) {
  return (
    <text
      x={60}
      y={y}
      dominantBaseline="middle"
      textAnchor="end"
      fontSize={10}
      fill={AXIS_COLOR}
    >
      {children}
    </text>
  );
}

function Legend({ days }: { days: ScreenTimeDay[] | null }) {
  const day = (days ?? []).reduce((sum, d) => sum + d.daySeconds, 0);
  const night = (days ?? []).reduce((sum, d) => sum + d.nightSeconds, 0);
  const total = day + night;

  return (
    <div className="ms-2.5 w-[243px] pt-[34px]">
      <LegendItem
        label="Day time"
        tip="Day time is between 6 AM–10 PM."
        seconds={day}
        share={total > 0 ? day / total : 0}
        color={DAY_COLOR}
      />
      <LegendItem
        label="Night time"
        tip="Night time is between 10 PM–6 AM."
        seconds={night}
        share={total > 0 ? night / total : 0}
        color={NIGHT_COLOR}
      />
      <p className="text-[rgb(255_255_255/0.9)]">
        <span className="me-1 text-[14px] leading-[17px] font-semibold">Total</span>
        <span className="text-[13px] leading-[17px]">{formatDuration(total)}</span>
      </p>
    </div>
  );
}

function LegendItem({
  label,
  tip,
  seconds,
  share,
  color,
}: {
  label: string;
  tip: string;
  seconds: number;
  share: number;
  color: string;
}) {
  return (
    <div className="h-[87px]">
      <p className="flex items-center gap-[5px] text-[14px] leading-[17px] font-semibold text-[rgb(255_255_255/0.9)]">
        {label}
        <Tooltip label={tip} placement="top">
          <span tabIndex={0} aria-label={tip} className="inline-flex">
            <InfoCircleIcon className="h-3.5 w-3.5" />
          </span>
        </Tooltip>
      </p>
      {share > 0 && (
        <svg width={LEGEND_BAR_WIDTH} height={6} aria-hidden="true" className="my-[5px] block">
          <rect width={share * LEGEND_BAR_WIDTH} height={6} fill={color} />
        </svg>
      )}
      <p className="text-[13px] leading-[17px] text-[rgb(255_255_255/0.9)]">
        {formatDuration(seconds)}
      </p>
    </div>
  );
}
