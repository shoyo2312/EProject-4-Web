import { MetricTabs } from "@/components/studio/MetricTabs";
import { EmptyState, SectionTitle, StudioCard } from "@/components/studio/ui";
import { BarList } from "@/components/studio/video/BarList";
import type { CreatorVideoViewers } from "@/lib/api/types";
import { AGE_GROUPS, AGE_GROUP_LABELS } from "@/lib/studio/metrics";

/**
 * Who watched in the window: totals against the window before, then — once the
 * audience is large enough for the server to say — new against returning,
 * followers against not, and age groups.
 */
export function ViewerBreakdown({ viewers }: { viewers: CreatorVideoViewers }) {
  const groups = viewers.breakdownAvailable && [
    {
      title: "Viewer type",
      rows: [
        { key: "new", label: "New", value: viewers.newViewers },
        { key: "returning", label: "Returning", value: viewers.returning ?? 0 },
      ],
    },
    {
      title: "Followers",
      rows: [
        { key: "followers", label: "Followers", value: viewers.followers ?? 0 },
        { key: "non-followers", label: "Non-followers", value: viewers.nonFollowers ?? 0 },
      ],
    },
    {
      title: "Age",
      rows: AGE_GROUPS.map((group) => ({
        key: group,
        label: AGE_GROUP_LABELS[group],
        value: viewers.ageGroups?.[group] ?? 0,
      })),
    },
  ];

  return (
    <section className="flex flex-col gap-4">
      <SectionTitle>Viewers</SectionTitle>
      <MetricTabs
        metrics={[
          { key: "total", label: "Total viewers", value: viewers.total, previous: viewers.previousTotal },
          { key: "new", label: "New viewers", value: viewers.newViewers, previous: viewers.previousNewViewers },
        ]}
        days={[]}
      />
      {groups ? (
        <div className="grid grid-cols-3 gap-6">
          {groups.map((group) => (
            <StudioCard key={group.title} className="flex flex-col gap-4 p-6">
              <h3 className="text-[14px] leading-[18px] font-semibold text-black">{group.title}</h3>
              <BarList rows={group.rows} total={viewers.total} />
            </StudioCard>
          ))}
        </div>
      ) : (
        <StudioCard>
          <EmptyState>You&rsquo;ll be able to see this once you have enough viewers to analyze.</EmptyState>
        </StudioCard>
      )}
    </section>
  );
}
