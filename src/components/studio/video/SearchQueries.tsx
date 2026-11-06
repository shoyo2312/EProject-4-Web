import { BarList } from "@/components/studio/video/BarList";
import { EmptyState, SectionTitle, StudioCard } from "@/components/studio/ui";
import type { SearchQueryRow } from "@/lib/api/types";

/** What viewers searched to find the video, as a share of the search views listed. */
export function SearchQueries({ rows }: { rows: SearchQueryRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.views, 0);

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Search queries</SectionTitle>
      <StudioCard className="p-6">
        {rows.length === 0 ? (
          <EmptyState>No search traffic yet</EmptyState>
        ) : (
          <BarList rows={rows.map((row) => ({ key: row.query, label: row.query, value: row.views }))} total={total} />
        )}
      </StudioCard>
    </section>
  );
}
