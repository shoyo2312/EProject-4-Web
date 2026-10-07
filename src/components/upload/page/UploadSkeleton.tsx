"use client";

import { Skeleton } from "@/components/ui/skeleton";

/**
 * Placeholder for the signed-in upload page while `/me` settles.
 *
 * It reuses the page's own wrapper — `max-w-[1000px]`, `px-8 py-10`, the 24/32
 * title with `mb-6`, and the dashed drop zone with its `px-6 py-20` — so the
 * heading and the zone do not move when the real form takes over. The shell for
 * a signed-out viewer is a different (centred) layout, and it replaces this.
 */
export function UploadSkeleton() {
  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1000px] px-8 py-10">
        <Skeleton className="mb-6 h-8 w-[168px]" />

        <div className="flex flex-col items-center justify-center rounded-[8px] border-2 border-dashed border-white/20 bg-white/[0.03] px-6 py-20 text-center">
          <Skeleton className="h-12 w-12 rounded-full" />
          <Skeleton className="mt-4 h-6 w-[196px]" />
          <Skeleton className="mt-1 h-5 w-[152px]" />
          <Skeleton className="mt-6 h-11 w-[148px] rounded-[4px]" />

          <div className="mt-10 grid w-full gap-6 text-left sm:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i}>
                <Skeleton className="h-5 w-32" />
                {/* The `dd` under it runs to three short lines in the widest
                    column, which is what sets the row's 54px height. */}
                <Skeleton className="mt-1 h-[54px] w-full" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
