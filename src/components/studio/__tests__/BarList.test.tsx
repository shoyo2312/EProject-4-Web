import { afterEach, describe, expect, it } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { BarList } from "@/components/studio/video/BarList";

afterEach(cleanup);

describe("BarList", () => {
  it("omitsZeroRowsAndRoundsPercentages", () => {
    render(
      <BarList
        rows={[
          { key: "a", label: "a", value: 75 },
          { key: "b", label: "b", value: 25 },
          { key: "c", label: "c", value: 0 },
        ]}
        total={100}
      />,
    );

    expect(screen.getByText("75%")).toBeTruthy();
    expect(screen.getByText("25%")).toBeTruthy();
    expect(screen.queryByText("c")).toBeNull();
  });

  it("rendersNothingWithoutATotal", () => {
    const { container } = render(<BarList rows={[{ key: "a", label: "a", value: 0 }]} total={0} />);

    expect(container.innerHTML).toBe("");
  });
});
