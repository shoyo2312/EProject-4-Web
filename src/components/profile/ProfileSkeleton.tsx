import { Skeleton } from "@/components/ui/skeleton";

/** Placeholder for `ProfilePage` while the profile + video grid load. */
export function ProfileSkeleton() {
  return (
    <main className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[692px] px-4 pt-8">
        <div className="flex items-center gap-6">
          <Skeleton className="h-[116px] w-[116px] rounded-full" />
          <div className="flex flex-col gap-3">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-9 w-28 rounded-[4px]" />
          </div>
        </div>
        <div className="mt-6 flex gap-6">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 w-20" />
        </div>
        <Skeleton className="mt-6 h-4 w-3/4" />

        <div className="mt-8 grid grid-cols-6 gap-x-4 gap-y-6 tt-1200:grid-cols-4 tt-840:grid-cols-3 tt-600:grid-cols-2 tt-600:gap-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[9/16] w-full rounded-[8px]" />
          ))}
        </div>
      </div>
    </main>
  );
}
