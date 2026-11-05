import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { toast } from "@/components/ui/toast";
import { AccountSettingsProvider, useAccountSettings } from "@/hooks/use-account-settings";
import type { UserSettingsResponse } from "@/lib/api/types";
import { getMySettings, updateMySettings } from "@/lib/api/users";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));
vi.mock("@/lib/api/users", () => ({ getMySettings: vi.fn(), updateMySettings: vi.fn() }));
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));

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

beforeEach(() => {
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });
});

afterEach(() => {
  cleanup();
  vi.resetAllMocks();
  pathname = "/";
  Reflect.deleteProperty(document, "visibilityState");
});

/** The tab coming back into view. */
const returnToTab = () => act(() => document.dispatchEvent(new Event("visibilitychange")));

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

it("reads again when the tab comes back, so a failed first read recovers", async () => {
  vi.mocked(getMySettings)
    .mockRejectedValueOnce(new Error("rate limited"))
    .mockResolvedValueOnce(settings);
  render(
    <AccountSettingsProvider>
      <Audience label="row" />
    </AccountSettingsProvider>,
  );
  await waitFor(() => expect(getMySettings).toHaveBeenCalledTimes(1));
  expect(screen.getByText("row: loading")).toBeTruthy();

  await returnToTab();

  await waitFor(() => expect(screen.getByText("row: FRIENDS")).toBeTruthy());
});

function SaveNoOne() {
  const { update } = useAccountSettings();
  return (
    <button type="button" onClick={() => void update({ commentAudience: "NO_ONE" })}>
      save
    </button>
  );
}

it("never lets a read that started before a save undo it", async () => {
  let answerLateRead: (value: UserSettingsResponse) => void = () => {};
  vi.mocked(getMySettings)
    .mockResolvedValueOnce(settings)
    .mockImplementationOnce(() => new Promise((resolve) => (answerLateRead = resolve)));
  vi.mocked(updateMySettings).mockResolvedValue({ ...settings, commentAudience: "NO_ONE" });
  render(
    <AccountSettingsProvider>
      <Audience label="row" />
      <SaveNoOne />
    </AccountSettingsProvider>,
  );
  await waitFor(() => expect(screen.getByText("row: FRIENDS")).toBeTruthy());

  await returnToTab(); // a read goes out…
  fireEvent.click(screen.getByRole("button", { name: "save" })); // …a save lands…
  await waitFor(() => expect(screen.getByText("row: NO_ONE")).toBeTruthy());
  await act(async () => answerLateRead(settings)); // …then the read answers, from before it

  expect(screen.getByText("row: NO_ONE")).toBeTruthy();
});

it("says a failed read only on /setting, not over the feed", async () => {
  vi.mocked(getMySettings).mockRejectedValue(new Error("down"));
  const { unmount } = render(
    <AccountSettingsProvider>
      <Audience label="row" />
    </AccountSettingsProvider>,
  );
  await waitFor(() => expect(getMySettings).toHaveBeenCalled());
  expect(toast.error).not.toHaveBeenCalled();
  unmount();

  pathname = "/setting";
  render(
    <AccountSettingsProvider>
      <Audience label="row" />
    </AccountSettingsProvider>,
  );
  await waitFor(() => expect(toast.error).toHaveBeenCalled());
});
