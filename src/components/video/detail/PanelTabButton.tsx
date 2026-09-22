"use client";

import { cn } from "@/lib/utils";

/** One label in the side panel's tab row — active is white over a 2px rule. */
export function PanelTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative h-10 text-[15px] font-semibold transition-colors",
        active
          ? "text-[var(--tt-text)]"
          : "text-[var(--tt-text-secondary)] hover:text-[var(--tt-text)]",
      )}
    >
      {children}
    </button>
  );
}
