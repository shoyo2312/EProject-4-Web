"use client";

/**
 * `[data-e2e="feed-navigation-prev"|"feed-navigation-next"]` — 48×48, sitting
 * 16px from the feed column's right edge with a 16px gap. They live inside the
 * column, so opening the comment sidebar shifts them by exactly the panel width
 * (measured live: x 1856 → 1472, a 384px delta).
 */
export function FeedNavArrows({
  onUp,
  onDown,
}: {
  onUp: () => void;
  onDown: () => void;
}) {
  return (
    <div className="absolute right-4 top-1/2 z-10 flex -translate-y-1/2 flex-col gap-4 tt-1024:hidden">
      <ArrowButton onClick={onUp} label="Previous video" direction="up" />
      <ArrowButton onClick={onDown} label="Next video" direction="down" />
    </div>
  );
}

function ArrowButton({
  onClick,
  label,
  direction,
}: {
  onClick: () => void;
  label: string;
  direction: "up" | "down";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--tt-field)] text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-shape-neutral-3)]"
    >
      <svg
        viewBox="0 0 48 48"
        className={`h-6 w-6 ${direction === "down" ? "rotate-180" : ""}`}
        fill="currentColor"
      >
        <path d="M24 15.4 8.7 30.7a1 1 0 0 0 0 1.4l1.4 1.4a1 1 0 0 0 1.4 0L24 20.9l12.5 12.6a1 1 0 0 0 1.4 0l1.4-1.4a1 1 0 0 0 0-1.4L24 15.4Z" />
      </svg>
    </button>
  );
}
