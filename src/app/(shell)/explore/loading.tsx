import { Skeleton } from "@/components/ui/skeleton";

/** Widths of the real category chips, in order, measured at 1920px. */
const CHIP_WIDTHS = [50, 163, 92, 79, 149, 104, 88, 132, 96, 118, 84, 140];

/**
 * Route-level placeholder for `/explore`.
 *
 * Measured in Chrome at 1920×936 against the live grid, so the chips and the
 * first tile row land where `ExploreGrid` puts them:
 *
 *   main    px-6 pb-12; content starts at x 264
 *   bar     sticky, pt-16 pb-6 (130 tall); 42px chevrons and 42px chips, gap 8
 *   grid    6 columns at 2xl, column gap 16, row gap 24, tile 256 wide
 *   tile    3/4 poster (342 tall), 8px gap, 2-line caption (40), 24px author row
 */
export default function Loading() {
  return (
    <main className="h-screen flex-1 overflow-y-auto px-6 pb-12 tt-1024:px-4">
      <div className="sticky top-0 z-10 flex items-center gap-2 bg-[var(--tt-page)] pt-16 pb-6">
        <Skeleton className="h-[42px] w-[42px] flex-none rounded-full tt-768:hidden" />

        <div className="no-scrollbar flex flex-1 gap-2 overflow-x-hidden">
          {CHIP_WIDTHS.map((width, i) => (
            <div key={i} className="flex-none" style={{ width }}>
              <Skeleton className="h-[42px] w-full rounded-[8px]" />
            </div>
          ))}
        </div>

        <Skeleton className="h-[42px] w-[42px] flex-none rounded-full tt-768:hidden" />
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
        {Array.from({ length: 12 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-2">
            <Skeleton className="aspect-[3/4] w-full rounded-[8px]" />
            {/* `line-clamp-2` caption: two 18px lines 4px apart = the 40 the
                real tile reserves. */}
            <div className="flex flex-col gap-1">
              <Skeleton className="h-[18px] w-full" />
              <Skeleton className="h-[18px] w-2/3" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-6 flex-none rounded-full" />
              <Skeleton className="h-[18px] w-24" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
