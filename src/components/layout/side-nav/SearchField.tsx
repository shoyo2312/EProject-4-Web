"use client";

import { SearchIcon } from "@/components/icons";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/utils";

/**
 * The field in the rail. It is a trigger, not an input: on the live site a
 * click anywhere in it opens the search panel, which carries the real field —
 * see `SearchDrawer`. Measured 208 × 40, radius 999px, background
 * rgba(255,255,255,.13); collapsed it is the 40 × 40 circle holding just the
 * icon, which is what stays on screen while the panel is open.
 */
export function SearchField({
  collapsed = false,
  iconOnly = false,
  onOpen,
}: {
  collapsed?: boolean;
  iconOnly?: boolean;
  onOpen: () => void;
}) {
  const button = (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Search"
      className={cn(
        "flex h-10 items-center rounded-full bg-[var(--tt-field)] py-1.5 text-start",
        collapsed
          ? "w-10 justify-center px-0"
          : "w-full px-2.5 tt-1024:w-10 tt-1024:justify-center tt-1024:px-0",
      )}
    >
      <SearchIcon className="h-4 w-4 flex-none text-[var(--tt-placeholder)]" />
      <span
        className={cn(
          "ml-2 text-[15px] text-[var(--tt-placeholder)]",
          collapsed ? "hidden" : "tt-1024:hidden",
        )}
      >
        Search
      </span>
    </button>
  );

  return iconOnly ? (
    <Tooltip label="Search" placement="right">
      {button}
    </Tooltip>
  ) : (
    button
  );
}
