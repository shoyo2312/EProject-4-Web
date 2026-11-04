"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";

import { FilterChip, Popover } from "@/components/studio/ui";
import { inRange, monthGrid, pickDay, sameDay } from "@/lib/studio/calendar";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" });

export interface DayRange {
  start: Date | null;
  end: Date | null;
}

/**
 * TikTok's "Comment date" chip: a month calendar where two presses pick a
 * span, then Reset or Apply. One press and Apply is that single day.
 */
export function DateRangeChip({ value, onApply }: { value: DayRange; onApply: (range: DayRange) => void }) {
  const today = new Date();
  const [month, setMonth] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [draft, setDraft] = useState<DayRange>(value);

  const shift = (by: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + by, 1));

  return (
    <Popover
      className="w-[320px] px-4 pt-4 pb-0"
      trigger={({ open, toggle }) => (
        <FilterChip
          label="Comment date"
          active={value.start !== null}
          open={open}
          onClick={() => {
            setDraft(value);
            toggle();
          }}
        />
      )}
    >
      {(close) => (
        <>
          <div className="mb-3 flex items-center justify-between">
            <button type="button" onClick={() => shift(-1)} aria-label="Previous month" className="rounded p-1 hover:bg-black/5">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-[14px] font-semibold">{MONTH.format(month)}</span>
            <button type="button" onClick={() => shift(1)} aria-label="Next month" className="rounded p-1 hover:bg-black/5">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-y-1 text-center text-[13px]">
            {WEEKDAYS.map((day) => (
              <span key={day} className="pb-1 text-[12px] text-black/34">
                {day}
              </span>
            ))}
            {monthGrid(month.getFullYear(), month.getMonth()).map((day, index) => {
              if (!day) return <span key={`pad-${index}`} />;
              const isEnd = sameDay(day, draft.start) || sameDay(day, draft.end);
              const future = day > today;
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  disabled={future}
                  onClick={() => setDraft(pickDay(draft.start, draft.end, day))}
                  className={cn(
                    "mx-auto flex h-8 w-full items-center justify-center",
                    inRange(day, draft.start, draft.end) && "bg-[#fe2c55]/10",
                    future && "text-black/20",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full",
                      isEnd ? "bg-[#fe2c55] font-semibold text-white" : !future && "hover:bg-black/5",
                    )}
                  >
                    {day.getDate()}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="mt-3 flex justify-end gap-2 border-t border-black/8 py-3">
            <button
              type="button"
              onClick={() => {
                setDraft({ start: null, end: null });
                onApply({ start: null, end: null });
                close();
              }}
              className="h-9 rounded-[4px] border border-black/12 px-5 text-[14px] font-semibold hover:bg-black/3"
            >
              Reset
            </button>
            <button
              type="button"
              disabled={!draft.start}
              onClick={() => {
                onApply({ start: draft.start, end: draft.end ?? draft.start });
                close();
              }}
              className="h-9 rounded-[4px] bg-[#fe2c55] px-5 text-[14px] font-semibold text-white hover:bg-[#ea284e] disabled:opacity-50"
            >
              Apply
            </button>
          </div>
        </>
      )}
    </Popover>
  );
}
