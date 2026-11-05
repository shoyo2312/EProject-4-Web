import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { ScreenTimeSummaryRow } from "@/components/settings/rows/ScreenTimeSummary";
import { getScreenTimeWeek, type ScreenTimeWeekResponse } from "@/lib/api/screen-time";
import type { SettingsRow } from "@/types/tiktok";

vi.mock("@/lib/api/screen-time", () => ({ getScreenTimeWeek: vi.fn() }));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn() } }));
let signedIn = true;
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ requireSignIn: () => signedIn }),
}));

const row: SettingsRow = {
  kind: "expand",
  title: "Summary",
  description: "Your weekly metrics include your time on the app and on nowa.com.",
  action: "screen-time-summary",
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The week from `start`, one [day, night] pair of seconds per day. */
function week(start: string, seconds: [number, number][]): ScreenTimeWeekResponse {
  const [y, m, d] = start.split("-").map(Number);
  return {
    weekStart: start,
    days: seconds.map(([daySeconds, nightSeconds], i) => ({
      date: iso(new Date(y, m - 1, d + i)),
      daySeconds,
      nightSeconds,
    })),
  };
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.mocked(getScreenTimeWeek).mockReset();
  signedIn = true;
});

it("asks a signed-out viewer to sign in rather than opening onto a chart it cannot read", () => {
  signedIn = false;
  const onToggle = vi.fn();
  render(<ScreenTimeSummaryRow row={row} expanded={false} onToggle={onToggle} />);

  fireEvent.click(screen.getByRole("button", { name: /^Summary/ }));

  expect(onToggle).not.toHaveBeenCalled();
});

it("draws seven bars from the week and refetches when another week is picked", async () => {
  vi.mocked(getScreenTimeWeek).mockImplementation(async (start) =>
    week(start, [[0, 0], [600, 0], [0, 0], [0, 0], [0, 0], [0, 336], [0, 0]]),
  );
  const { container } = render(<ScreenTimeSummaryRow row={row} expanded onToggle={() => {}} />);

  expect(await screen.findByText("16m")).toBeTruthy(); // total
  expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-19");
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);
  expect(screen.getByText("10m")).toBeTruthy(); // day time
  expect(screen.getByText("6m")).toBeTruthy(); // night time, 5.6 minutes

  fireEvent.click(screen.getByRole("button", { name: /Oct 19, 2026-Oct 25, 2026/ }));
  fireEvent.click(screen.getByRole("option", { name: /Oct 12, 2026-Oct 18, 2026/ }));

  await waitFor(() => expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-12"));
});

it("shows a placeholder, not an empty chart, until the week is read — and again for the next week", async () => {
  let resolve: (value: ScreenTimeWeekResponse) => void = () => {};
  vi.mocked(getScreenTimeWeek).mockImplementation(
    (start) => new Promise((done) => (resolve = (value) => done({ ...value, weekStart: start }))),
  );
  const { container } = render(<ScreenTimeSummaryRow row={row} expanded onToggle={() => {}} />);

  expect(screen.getByRole("status", { name: "Loading screen time" })).toBeTruthy();
  expect(container.querySelectorAll("[data-day]")).toHaveLength(0);
  expect(screen.queryByText("Total")).toBeNull();

  resolve(week("2026-10-19", [[600, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0], [0, 0]]));
  expect(await screen.findByText("Total")).toBeTruthy();
  expect(screen.queryByRole("status")).toBeNull();
  expect(container.querySelectorAll("[data-day]")).toHaveLength(7);

  fireEvent.click(screen.getByRole("button", { name: /Oct 19, 2026-Oct 25, 2026/ }));
  fireEvent.click(screen.getByRole("option", { name: /Oct 12, 2026-Oct 18, 2026/ }));
  expect(await screen.findByRole("status", { name: "Loading screen time" })).toBeTruthy();
  expect(screen.queryByText("Total")).toBeNull();
});

it("opens on the week a weekly update names, if it is one of the last four", async () => {
  vi.mocked(getScreenTimeWeek).mockImplementation(async (start) => week(start, []));
  render(<ScreenTimeSummaryRow row={row} expanded onToggle={() => {}} week="2026-10-12" />);

  await waitFor(() => expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-12"));
  expect(getScreenTimeWeek).not.toHaveBeenCalledWith("2026-10-19");
  expect(screen.getByRole("button", { name: /Oct 12, 2026-Oct 18, 2026/ })).toBeTruthy();
});

it("falls back to this week for a week it does not offer", async () => {
  vi.mocked(getScreenTimeWeek).mockImplementation(async (start) => week(start, []));
  render(<ScreenTimeSummaryRow row={row} expanded onToggle={() => {}} week="2026-01-05" />);

  await waitFor(() => expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-19"));
});
