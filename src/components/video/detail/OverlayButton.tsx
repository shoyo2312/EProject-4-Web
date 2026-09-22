"use client";

import { cn } from "@/lib/utils";

/**
 * A round control floating over the player. `disabled` dims it, which is how
 * the first and last video of a collection show there is nothing to step to.
 */
export function OverlayButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const className =
    "flex h-10 w-10 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      className={cn(
        className,
        disabled && "cursor-default opacity-40 hover:bg-[var(--tt-field)]",
      )}
    >
      {children}
    </button>
  );
}
