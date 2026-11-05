"use client";

import { Check, ChevronDown, CircleX, ListFilter } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

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

/** TikTok's two loading dots, cyan and red trading places. */
export function StudioLoader({ className }: { className?: string }) {
  return (
    <div role="status" aria-label="Loading" className={cn("flex items-center justify-center", className)}>
      <span className="h-2.5 w-2.5 animate-tt-dot-cyan rounded-full bg-[#25f4ee] motion-reduce:animate-none" />
      <span className="h-2.5 w-2.5 animate-tt-dot-red rounded-full bg-[#fe2c55] mix-blend-multiply motion-reduce:animate-none" />
    </div>
  );
}

/**
 * A popover anchored under its trigger, closed on an outside press or Escape.
 * Fades in and out while sliding 4px, TikTok's 200ms dropdown motion; it stays
 * mounted so the close can animate too.
 */
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
  // The menu is built only while it shows, plus the 200ms it takes to fade out: a closed row
  // menu would otherwise be reconciled on every change to the list around it.
  const [mounted, setMounted] = useState(false);
  const close = useCallback(() => setOpen(false), []);
  const show = useCallback(() => {
    setMounted(true);
    setOpen(true);
  }, []);
  useDismiss(root, open, close);
  useEffect(() => {
    if (open) return;
    const id = window.setTimeout(() => setMounted(false), 200);
    return () => window.clearTimeout(id);
  }, [open]);

  return (
    <div ref={root} className="relative">
      {trigger({ open, toggle: open ? close : show })}
      <div
        className={cn(
          "absolute top-[calc(100%+6px)] z-20 rounded-[8px] bg-white py-2 shadow-[0_2px_12px_rgba(0,0,0,0.12)]",
          "transition-[opacity,translate,display] transition-discrete duration-200 ease-[cubic-bezier(0.65,0,0.35,1)] motion-reduce:transition-none",
          open ? "block translate-y-0 opacity-100 starting:-translate-y-1 starting:opacity-0" : "hidden -translate-y-1 opacity-0",
          align === "end" ? "right-0" : "left-0",
          className,
        )}
      >
        {mounted && children(close)}
      </div>
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

/**
 * A filter chip: "≡ Privacy". Grey with a dark outline while its menu is open;
 * once a filter is set, a red dot on the icon and, given `onClear`, a ⓧ that
 * drops the filter without opening the menu.
 */
export function FilterChip({
  label,
  active,
  open,
  onClick,
  onClear,
}: {
  label: string;
  active: boolean;
  open: boolean;
  onClick: () => void;
  onClear?: () => void;
}) {
  return (
    <div
      className={cn(
        "flex h-9 items-center rounded-[8px] border px-3 text-[14px] leading-[18px] font-medium text-black transition-colors",
        open ? "border-black bg-black/5" : "border-black/8 bg-white hover:bg-black/3",
      )}
    >
      <button type="button" onClick={onClick} aria-expanded={open} className="flex h-full items-center gap-[3px]">
        <span className="relative">
          <ListFilter className="h-4 w-4" strokeWidth={2} />
          {active && <span className="absolute top-0 right-0 h-1.5 w-1.5 rounded-full bg-[#fe2c55]" />}
        </span>
        {label}
      </button>
      {active && onClear && (
        <>
          <span aria-hidden className="mx-2 h-2 border-l border-black/12" />
          <button
            type="button"
            onClick={onClear}
            aria-label={`Clear ${label}`}
            className="flex text-white [&_svg]:fill-black/34 hover:[&_svg]:fill-black/50"
          >
            <CircleX className="h-4 w-4 transition-[fill]" strokeWidth={2} />
          </button>
        </>
      )}
    </div>
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
      <span className="truncate" title={label}>
        {label}
      </span>
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

/** TikTok's 16px checkbox: grey 2px ring, red fill with a white tick once checked. */
export function Checkbox({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <span className="relative flex h-4 w-4 flex-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded-[3px] border-2 border-black/17 transition-colors duration-200 checked:border-[#fe2c55] checked:bg-[#fe2c55] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
      />
      <Check
        className="pointer-events-none absolute inset-0 m-auto h-3 w-3 text-white opacity-0 transition-opacity duration-200 peer-checked:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
}
