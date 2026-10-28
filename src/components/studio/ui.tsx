"use client";

import { Check, ChevronDown, ListFilter } from "lucide-react";
import { useCallback, useRef, useState } from "react";

import { useDismiss } from "@/hooks/use-dismiss";
import { RANGE_OPTIONS, rangeLabel, type RangeDays } from "@/lib/studio/metrics";
import { cn } from "@/lib/utils";

/** Studio's surface: white, hairline border, 8px corners. */
export function StudioCard({ className, children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("rounded-[8px] border border-black/8 bg-white", className)}>{children}</div>
  );
}

/** "Key metrics ›" — a section title, 16px bold. */
export function SectionTitle({ children, chevron }: { children: React.ReactNode; chevron?: boolean }) {
  return (
    <h2 className="flex items-center gap-1 text-[16px] leading-[21px] font-bold text-black">
      {children}
      {chevron && <span aria-hidden className="text-[18px] leading-none">›</span>}
    </h2>
  );
}

/** Pulsing placeholder on Studio's light surface. */
export function StudioSkeleton({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-[4px] bg-black/6", className)} />;
}

/** A popover anchored under its trigger, closed on an outside press or Escape. */
export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: {
  trigger: (props: { open: boolean; toggle: () => void }) => React.ReactNode;
  children: (close: () => void) => React.ReactNode;
  align?: "start" | "end";
  className?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(root, open, close);

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: () => setOpen((value) => !value) })}
      {open && (
        <div
          className={cn(
            "absolute top-[calc(100%+6px)] z-20 rounded-[8px] bg-white py-2 shadow-[0_2px_12px_rgba(0,0,0,0.12)]",
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children(close)}
        </div>
      )}
    </div>
  );
}

/** The range dropdown: "Last 7 days ⌄" with a ticked menu. */
export function RangeSelect({ days, onChange }: { days: RangeDays; onChange: (days: RangeDays) => void }) {
  return (
    <Popover
      align="end"
      className="w-[200px]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          className="flex h-8 items-center gap-1 rounded-[6px] border border-black/8 bg-white px-3 text-[14px] leading-5 font-medium text-black transition-colors hover:bg-black/3"
        >
          {rangeLabel(days)}
          <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
        </button>
      )}
    >
      {(close) =>
        RANGE_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => {
              onChange(option);
              close();
            }}
            className="flex h-10 w-full items-center justify-between px-4 text-left text-[14px] text-black hover:bg-black/4"
          >
            {rangeLabel(option)}
            {option === days && <Check className="h-4 w-4" />}
          </button>
        ))
      }
    </Popover>
  );
}

/** A filter chip: "≡ Privacy". Dark outline while its menu is open or a filter is set. */
export function FilterChip({
  label,
  active,
  open,
  onClick,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={open}
      className={cn(
        "flex h-8 items-center gap-1 rounded-[8px] border bg-white px-3 text-[14px] leading-5 font-semibold text-black transition-colors hover:bg-black/3",
        open || active ? "border-black/65" : "border-black/8",
      )}
    >
      <ListFilter className="h-4 w-4" strokeWidth={2} />
      {label}
    </button>
  );
}

/** One option in a chip's menu, ticked when picked. */
export function MenuOption({
  label,
  selected,
  onClick,
}: {
  label: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex h-10 w-full items-center justify-between gap-6 px-4 text-left text-[14px] whitespace-nowrap text-black hover:bg-black/4"
    >
      {label}
      {selected && <Check className="h-4 w-4 flex-none" />}
    </button>
  );
}

/** The grey line under a section while there is nothing to show yet. */
export function EmptyState({ children }: { children: React.ReactNode }) {
  return (
    <p className="py-10 text-center text-[14px] leading-[18px] text-black/34">{children}</p>
  );
}
