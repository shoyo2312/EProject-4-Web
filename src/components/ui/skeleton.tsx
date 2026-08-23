import { cn } from "@/lib/utils";

/** Pulsing placeholder block — pass sizing/shape via `className`. */
export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-[4px] bg-[var(--tt-field)]", className)}
    />
  );
}
