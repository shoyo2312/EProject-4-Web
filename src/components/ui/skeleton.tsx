import type { CSSProperties } from "react";

import { cn } from "@/lib/utils";

/** Pulsing placeholder block — pass sizing/shape via `className`. */
export function Skeleton({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-[4px] bg-[var(--tt-field)]", className)}
      style={style}
    />
  );
}
