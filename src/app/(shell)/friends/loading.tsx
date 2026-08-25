import { Skeleton } from "@/components/ui/skeleton";

/**
 * Route-level placeholder for `/friends` — the same creator grid `/following`
 * falls back to, measured with it.
 *
 * Measured in Chrome at 1920×936 against the live creator grid:
 *
 *   wrapper  736 wide, centred, pt-5 pb-[18px], 18px gaps — three per row
 *   card     226 × 302, radius 8
 *   overlay  avatar 48 at +133, name at +195 (24), handle at +219 (18),
 *            Follow button 164 × 37 at +245
 */
export default function Loading() {
  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto flex w-[736px] max-w-full flex-wrap content-start gap-[18px] pt-5 pb-[18px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="relative h-[302px] w-[226px] overflow-hidden rounded-[8px] bg-[#252525]"
          >
            <div className="absolute inset-x-0 top-[102px] flex h-[200px] flex-col items-center justify-end px-3 pt-[30px] pb-5">
              <Skeleton className="mb-[14px] h-12 w-12 rounded-full" />
              <Skeleton className="h-6 w-[120px]" />
              <Skeleton className="mt-0 h-[18px] w-20" />
              <Skeleton className="mt-2 h-[37px] w-[164px] rounded-[4px]" />
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}
