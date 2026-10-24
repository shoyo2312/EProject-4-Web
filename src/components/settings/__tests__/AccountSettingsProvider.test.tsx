import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { AccountSettingsProvider, useAccountSettings } from "@/hooks/use-account-settings";
import type { UserSettingsResponse } from "@/lib/api/types";
import { getMySettings } from "@/lib/api/users";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));
vi.mock("@/lib/api/users", () => ({ getMySettings: vi.fn(), updateMySettings: vi.fn() }));

const settings: UserSettingsResponse = {
  commentAudience: "FRIENDS",
  dmAudience: "EVERYONE",
  screenTimeLimitMinutes: null,
  screenTimeLimitsByDay: null,
  hasScreenTimePasscode: false,
  sleepHoursStart: null,
  sleepHoursEnd: null,
  weeklyScreenTimeDigest: true,
  privateAccount: false,
  filterSpamOffensive: true,
  filterAllComments: false,
  commentKeywords: [],
  pushLikes: true,
  pushComments: true,
  pushNewFollowers: true,
  inAppLikes: true,
  inAppComments: true,
  inAppNewFollowers: true,
  inAppReposts: true,
  timeZone: null,
};

afterEach(cleanup);

function Audience({ label }: { label: string }) {
  const { settings } = useAccountSettings();
  return (
    <p>
      {label}: {settings?.commentAudience ?? "loading"}
    </p>
  );
}

it("reads the settings once for every part of the app that shows them", async () => {
  vi.mocked(getMySettings).mockResolvedValue(settings);

  render(
    <AccountSettingsProvider>
      <Audience label="settings row" />
      <Audience label="screen time guard" />
    </AccountSettingsProvider>,
  );

  await waitFor(() => expect(screen.getByText("settings row: FRIENDS")).toBeTruthy());
  expect(screen.getByText("screen time guard: FRIENDS")).toBeTruthy();
  expect(getMySettings).toHaveBeenCalledTimes(1);
});
