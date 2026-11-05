import { BarList } from "@/components/studio/video/BarList";
import { SectionTitle, StudioCard } from "@/components/studio/ui";
import type { TrafficSourceRow } from "@/lib/api/types";
import { TRAFFIC_SOURCE_LABELS } from "@/lib/studio/metrics";

/** Where the window's views came from, busiest first, as a share of all of them. */
export function TrafficSources({ rows }: { rows: TrafficSourceRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);
  const sorted = [...rows].sort((a, b) => b.views - a.views);

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Traffic source</SectionTitle>
      <StudioCard className="p-6">
        <BarList
          rows={sorted.map((row) => ({ key: row.source, label: TRAFFIC_SOURCE_LABELS[row.source], value: row.views }))}
          total={total}
        />
      </StudioCard>
    </section>
  );
}
