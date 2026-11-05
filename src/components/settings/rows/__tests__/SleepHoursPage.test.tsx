import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import {
  SleepHoursPage,
  SleepHoursRow,
} from "@/components/settings/rows/screen-time/SleepHoursPage";
import type { AccountSettings } from "@/hooks/use-account-settings";
import type { UserSettingsResponse } from "@/lib/api/types";
import { DEFAULT_SETTINGS } from "@/lib/settings/__tests__/user-settings-fixture";
import type { SettingsRow } from "@/types/tiktok";

vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn() } }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ isSignedIn: true, isLoading: false, requireSignIn: () => true }),
}));

afterEach(cleanup);

function accountWith(overrides: Partial<UserSettingsResponse> = {}) {
  const update = vi.fn(async () => {});
  const account: AccountSettings = { settings: { ...DEFAULT_SETTINGS, ...overrides }, update };
  return { account, update };
}

function pick(column: string, option: string) {
  fireEvent.click(
    within(screen.getByRole("listbox", { name: column })).getByRole("option", { name: option }),
  );
}

it("shows end time eight hours after start and saves only the start", async () => {
  const { account, update } = accountWith({ sleepHoursStart: "22:00", sleepHoursEnd: "06:00" });
  const onLeave = vi.fn();
  render(<SleepHoursPage account={account} onLeave={onLeave} />);

  expect(screen.getByRole("button", { name: "Start time" }).textContent).toBe("10:00 PM");
  expect(screen.getByRole("button", { name: "End time" }).textContent).toBe("06:00 AM");

  fireEvent.click(screen.getByRole("button", { name: "Start time" }));
  pick("Hour", "11");
  pick("Minute", "30");

  expect(screen.getByRole("button", { name: "Start time" }).textContent).toBe("11:30 PM");
  expect(screen.getByRole("button", { name: "End time" }).textContent).toBe("07:30 AM");
  expect(screen.getByRole("button", { name: "End time" }).hasAttribute("disabled")).toBe(true);

  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(update).toHaveBeenCalledWith({ sleepHoursStart: "23:30" }));
  await waitFor(() => expect(onLeave).toHaveBeenCalled());
});

it("starts at 10:00 PM when sleep hours were off", async () => {
  const { account, update } = accountWith();
  render(<SleepHoursPage account={account} onLeave={() => {}} />);

  fireEvent.click(screen.getByRole("switch", { name: "Set your sleep hours" }));
  expect(screen.getByRole("button", { name: "Start time" }).textContent).toBe("10:00 PM");

  fireEvent.click(screen.getByRole("button", { name: "Start time" }));
  pick("AM/PM", "AM");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith({ sleepHoursStart: "10:00" }));
});

it("turning off saves null", async () => {
  const { account, update } = accountWith({ sleepHoursStart: "22:00", sleepHoursEnd: "06:00" });
  render(<SleepHoursPage account={account} onLeave={() => {}} />);

  fireEvent.click(screen.getByRole("switch", { name: "Set your sleep hours" }));
  // As live, the times stay on the page, greyed out.
  expect(screen.getByRole("button", { name: "Start time" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(update).toHaveBeenCalledWith({ sleepHoursStart: null }));
});

it("Cancel leaves without saving", () => {
  const { account, update } = accountWith({ sleepHoursStart: "22:00", sleepHoursEnd: "06:00" });
  const onLeave = vi.fn();
  render(<SleepHoursPage account={account} onLeave={onLeave} />);

  fireEvent.click(screen.getByRole("switch", { name: "Set your sleep hours" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));

  expect(onLeave).toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

const row: SettingsRow = {
  kind: "value",
  title: "Sleep hours",
  description: "Get reminded when you’re in your sleep hours.",
  value: "Off",
  action: "sleep-hours",
};

it("shows On on the row and opens the page", () => {
  const { account } = accountWith({ sleepHoursStart: "22:00", sleepHoursEnd: "06:00" });
  const onOpen = vi.fn();
  render(<SleepHoursRow row={row} account={account} onOpen={onOpen} />);

  expect(screen.getByText("On")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Sleep hours/ }));
  expect(onOpen).toHaveBeenCalled();
});
