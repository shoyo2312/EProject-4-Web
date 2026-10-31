"use client";

import { useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/utils";

/**
 * Hover/focus label for a control that shows only an icon — the sidebar rail once it
 * collapses to 4.5rem and drops its row labels.
 *
 * Portal + `position: fixed`: the rail is `overflow-x-clip`, so a normal CSS flyout would be
 * cut at the rail edge. Coordinates are read from the wrapped element on enter, so nothing has
 * to stay in sync while the tip is hidden. The wrapper is `display: contents` and adds no box.
 *
 * Two looks for the one primitive: `label` is the dark one-liner of the rail; `bubble` is the
 * white 240px explainer tiktok.com shows beside "Suggested accounts" (`right-start`: right of
 * the element, top-aligned, 4px gap). Both appear instantly — TikTok's tip has no fade.
 */
export function Tooltip({
  label,
  placement = "right",
  variant = "label",
  children,
}: {
  label: string;
  placement?: "top" | "right" | "right-start";
  variant?: "label" | "bubble";
  children: ReactNode;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const [coords, setCoords] = useState<{ x: number; y: number } | null>(null);

  function show() {
    const el = ref.current?.firstElementChild ?? ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setCoords(
      placement === "right"
        ? { x: r.right + 10, y: r.top + r.height / 2 }
        : placement === "right-start"
          ? { x: r.right + 4, y: r.top }
          : { x: r.left + r.width / 2, y: r.top - 8 },
    );
  }

  const hide = () => setCoords(null);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className="contents"
    >
      {children}
      {coords && typeof document !== "undefined"
        ? createPortal(
            <span
              role="tooltip"
              style={{ left: coords.x, top: coords.y }}
              className={cn(
                "pointer-events-none fixed z-[100]",
                variant === "bubble"
                  ? "max-w-[240px] whitespace-normal rounded-[12px] bg-white px-3 py-[9px] text-[14px] leading-[18.2px] font-medium text-black shadow-[0_2px_10px_rgba(0,0,0,0.21)]"
                  : "whitespace-nowrap rounded-md border border-[var(--tt-divider)] bg-[var(--tt-page)] px-2 py-1 text-[13px] font-medium text-[var(--tt-text)] shadow-lg",
                placement === "right"
                  ? "-translate-y-1/2"
                  : placement === "top"
                    ? "-translate-x-1/2 -translate-y-full"
                    : null,
              )}
            >
              {label}
            </span>,
            document.body,
          )
        : null}
    </span>
  );
}
