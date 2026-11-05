import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StudioLineChart } from "@/components/studio/charts/StudioLineChart";
import { dayLabel } from "@/lib/studio/metrics";

// Recharts measures its container through ResizeObserver. jsdom has none, and
// without one Recharts keeps the size the chart is given up front (`width`),
// so these tests must not stub it.

afterEach(cleanup);

const points = Array.from({ length: 7 }, (_, i) => ({
  label: `2026-10-${17 + i}`,
  value: (i + 1) * 10,
}));

describe("StudioLineChart", () => {
  it("drawsOneTickPerLabelIndex", () => {
    render(<StudioLineChart points={points} formatLabel={dayLabel} width={320} height={200} />);

    for (const point of points) {
      expect(screen.getByText(dayLabel(point.label))).toBeTruthy();
    }
  });

  // Recharts resolves the hovered point on the next animation frame.
  it("tooltipShowsLabelAndValue", async () => {
    const { container } = render(
      <StudioLineChart
        points={points}
        formatLabel={dayLabel}
        formatValue={(v) => `${v} views`}
        width={320}
        height={200}
      />,
    );

    const surface = container.querySelector(".recharts-wrapper")!;
    fireEvent.mouseMove(surface, { clientX: 160, clientY: 100 });

    await waitFor(() => expect(container.querySelector(".recharts-tooltip-wrapper")?.textContent).toContain("views"));
    const tooltip = container.querySelector(".recharts-tooltip-wrapper")!;
    const shown = points.find((point) => tooltip.textContent?.includes(`${point.value} views`));
    expect(shown).toBeDefined();
    expect(tooltip.textContent).toContain(dayLabel(shown!.label));
  });

  it("startsEmptyWithoutPoints", () => {
    const { container } = render(<StudioLineChart points={[]} width={320} height={200} />);

    expect(container.querySelector(".recharts-wrapper")).toBeTruthy();
  });
});

describe("StudioLineChart axis", () => {
  it("formatsTheAxisWithFormatTickWhenGiven", () => {
    render(
      <StudioLineChart
        points={points}
        yDomain={[0, 1]}
        formatValue={(v) => `${v * 100}% still watching`}
        formatTick={(v) => `${v * 100}%`}
        width={320}
        height={200}
      />,
    );

    expect(screen.getAllByText("100%").length).toBeGreaterThan(0);
    expect(screen.queryByText("100% still watching")).toBeNull();
  });
});
