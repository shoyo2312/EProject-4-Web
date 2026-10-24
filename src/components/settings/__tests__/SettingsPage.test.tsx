import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, expect, it, vi } from "vitest";

import { SettingsPage } from "@/components/settings/SettingsPage";
import { getScreenTimeWeek } from "@/lib/api/screen-time";
import { SETTINGS_SECTIONS } from "@/lib/site-config";

const replace = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back: vi.fn(), push: vi.fn(), replace }),
  useSearchParams: () => new URLSearchParams("summary=1"),
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
  useAccountSettings: () => ({ settings: null, update: vi.fn() }),
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

afterEach(cleanup);

it("opens the Screen time summary when a weekly update links to it", async () => {
  render(<SettingsPage sections={SETTINGS_SECTIONS} />);

  await waitFor(() =>
    expect(screen.getByRole("button", { name: /^Summary/ }).getAttribute("aria-expanded")).toBe(
      "true",
    ),
  );
  expect(getScreenTimeWeek).toHaveBeenCalled();
  // The link is spent, so the next weekly update opens it again.
  await waitFor(() => expect(replace).toHaveBeenCalledWith("/setting", { scroll: false }));
});
