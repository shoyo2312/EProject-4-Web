import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for `ProfilePage` while the profile + video grid load.
 *
 * Every box below is a block the real page occupies, measured in Chrome at
 * 1920px against `/@sashtalk` — so the skeleton and the page it becomes sit on
 * the same baselines and nothing jumps when the data lands:
 *
 *   container  1296 max-width, content-box, 32px inline / 24px block padding
 *   header     avatar 172, gap 28, mb 20; identity rows at +0 / +36 / +65 / +123
 *   tabs       44 tall, label 86 wide inside 32px padding either side (so 64
 *              between labels), 2px underline, 200×36 sort control
 *   grid       6 columns, 16px column gap, 24px row gap, tile 1 / 1.3265, r8
 */
export function ProfileSkeleton() {
  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto box-content max-w-[1296px] px-8 py-6 tt-1200:px-5 tt-1024:py-5 tt-840:p-3">
        <header className="mt-3 mb-5 flex items-start gap-7 tt-840:gap-4">
          <Skeleton className="h-[172px] w-[172px] flex-none rounded-full tt-840:h-24 tt-840:w-24" />

          <div className="flex min-w-0 flex-col">
            {/* h1 24/30 beside the handle */}
            <Skeleton className="h-[30px] w-[240px]" />
            {/* h3.H3Count, mt-1.5, 21px tall */}
            <Skeleton className="mt-1.5 h-[21px] w-[340px]" />

            <div className="mt-2 flex items-center gap-3">
              <Skeleton className="h-11 w-[92px] rounded-full" />
              <Skeleton className="h-11 w-[104px] rounded-full" />
              <Skeleton className="h-11 w-11 flex-none rounded-full" />
              <Skeleton className="h-11 w-11 flex-none rounded-full" />
            </div>

            {/* bio, mt-3.5, one 21px line */}
            <Skeleton className="mt-3.5 h-[21px] w-[420px] max-w-full" />
          </div>
        </header>

        <div className="relative flex items-center justify-between">
          <div className="flex h-11 items-center gap-16 pl-8 tt-840:gap-8 tt-840:pl-4">
            <Skeleton className="h-6 w-[86px]" />
            <Skeleton className="h-6 w-[95px]" />
            <Skeleton className="h-6 w-[105px]" />
            <Skeleton className="h-6 w-[71px]" />
          </div>
          <Skeleton className="h-9 w-[200px] flex-none rounded-[6px] tt-600:hidden" />
        </div>
        {/* The tab underline is a real 2px element on the live page. */}
        <Skeleton className="-mt-0.5 h-0.5 w-[150px] rounded-none" />

        {/* No tiles here on purpose. Nothing is known at this stage — not even
            the profile — and a guessed row of them is a lie on any account
            with fewer videos than the guess, an empty one most of all. The
            video total arrives with the profile, so `ProfileBody` puts the
            grid up a moment later knowing exactly how many tiles are coming. */}
      </div>
    </main>
  );
}
