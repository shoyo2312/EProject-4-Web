import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, expect, it, vi } from "vitest";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { getScreenTimeWeek } from "@/lib/api/screen-time";
import { DEFAULT_SETTINGS } from "@/lib/settings/__tests__/user-settings-fixture";
import { SETTINGS_SECTIONS } from "@/lib/site-config";

const replace = vi.fn();
const back = vi.fn();
let search = "summary=2026-10-12";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams(search),
}));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({
    user: { userId: "1" },
    isSignedIn: true,
    isLoading: false,
    requireSignIn: () => true,
  }),
}));
vi.mock("@/hooks/use-account-settings", () => ({
  useAccountSettings: () => ({ settings: DEFAULT_SETTINGS, update: vi.fn() }),
}));
vi.mock("@/hooks/use-browser-notifications", () => ({
  useBrowserNotifications: () => ({ on: false, blocked: false, unsupported: false, toggle: vi.fn() }),
}));
vi.mock("@/lib/api/screen-time", () => ({
  getScreenTimeWeek: vi.fn(async (weekStart: string) => ({ weekStart, days: [] })),
}));
// Rows with flows of their own, beside the point here.
vi.mock("@/components/settings/rows/AddEmailModal", () => ({ AddEmailRow: () => null }));
vi.mock("@/components/settings/rows/PasswordModal", () => ({ PasswordRow: () => null }));
vi.mock("@/components/settings/rows/CloseAccountModal", () => ({
  CloseAccountRow: () => null,
  CloseAccountPanel: () => null,
}));
vi.mock("@/components/settings/rows/download-data/DownloadDataPanel", () => ({
  DownloadDataRow: () => null,
  DownloadDataPanel: () => null,
}));

beforeAll(() => {
  // jsdom lays nothing out and has no element scrolling.
  HTMLElement.prototype.scrollTo = vi.fn();
});

beforeEach(() => {
  // Only the clock: rAF and waitFor keep running.
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(2026, 9, 21, 12));
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  search = "summary=2026-10-12";
  back.mockReset();
});

it("opens the Screen time summary on the week a weekly update links to", async () => {
  render(<SettingsPage sections={SETTINGS_SECTIONS} />);

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^Summary/ }).getAttribute("aria-expanded")).toBe(
      "true",
    ),
  );
  await waitFor(() => expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-12"));
  // The link is spent, so the next weekly update opens it again.
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/setting", { scroll: false }));
});

it("goes back from a page in the panel to the sections, not off /setting", () => {
  search = "";
  render(<SettingsPage sections={SETTINGS_SECTIONS} />);

  fireEvent.click(screen.getByRole("button", { name: /^Daily screen time/ }));
  expect(screen.getByText("Set your daily time")).toBeTruthy();

  fireEvent.click(screen.getByRole("button", { name: "Back" }));
  expect(screen.queryByText("Set your daily time")).toBeNull();
  expect(back).not.toHaveBeenCalled();
});
