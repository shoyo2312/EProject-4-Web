"use client";

import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from "react";

import { useDismiss } from "@/hooks/use-dismiss";
import { cn } from "@/lib/utils";

/** One column of the picker: its options, and the chosen one (-1 for none). */
export interface PickerColumn {
  label: string;
  options: string[];
  selected: number;
  onSelect: (index: number) => void;
}

/** An option's height — a column scrolls by it to bring its choice to the middle band. */
const OPTION_HEIGHT = 32;

/**
 * The live `ScrollInput`: a field showing the value, which opens one scrolling
 * column per part of it (hours and minutes, or hours, minutes and AM/PM) 4px
 * underneath. The chosen option sits in the middle band, red and bold.
 *
 * Measured live: menu #252525 with a 1px `rgba(255,255,255,.12)` border and a
 * 4px radius; columns 72 × 224 with 96px of padding at either end, so the
 * first and last options can reach the band; options 64 × 32, 14/21.
 */
export function PickerField({
  label,
  value,
  columns,
  icon,
  onOpen,
  align = "start",
  className,
  disabled = false,
}: {
  /** The field's accessible name; the button shows `value`. */
  label: string;
  value: string;
  columns: PickerColumn[];
  icon?: ReactNode;
  onOpen?: () => void;
  /** Which edge of the field the menu lines up with. */
  align?: "start" | "end";
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        onClick={() => {
          if (!open) onOpen?.();
          setOpen(!open);
        }}
        className={cn(
          "flex h-9 items-center justify-center rounded-[2px] border border-[rgb(255_255_255/0.12)] bg-[#121212] px-[11px] text-[16px] leading-6 text-[rgb(255_255_255/0.9)]",
          className,
        )}
      >
        {icon}
        {value}
      </button>

      {open && (
        <div
          className={cn(
            "absolute top-full z-10 mt-1 flex rounded-[4px] border border-[rgb(255_255_255/0.12)] bg-[#252525]",
            align === "end" ? "right-0" : "left-0",
          )}
        >
          {columns.map((column) => (
            <Column key={column.label} column={column} />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ column }: { column: PickerColumn }) {
  const ref = useRef<HTMLDivElement>(null);

  // On opening and after each pick, the choice scrolls into the middle band.
  useLayoutEffect(() => {
    if (ref.current && column.selected >= 0) {
      ref.current.scrollTop = column.selected * OPTION_HEIGHT;
    }
  }, [column.selected]);

  return (
    <div
      ref={ref}
      role="listbox"
      aria-label={column.label}
      className="no-scrollbar h-56 w-[72px] overflow-y-auto py-24"
    >
      {column.options.map((option, index) => {
        const chosen = index === column.selected;
        return (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={chosen}
            onClick={() => column.onSelect(index)}
            className={cn(
              "mx-1 block h-8 w-16 text-center text-[14px] leading-8",
              chosen
                ? "bg-[#121212] font-bold text-[#ff3b5c]"
                : "text-[rgb(255_255_255/0.9)] hover:bg-white/[0.04]",
            )}
          >
            {option}
          </button>
        );
      })}
    </div>
  );
}
