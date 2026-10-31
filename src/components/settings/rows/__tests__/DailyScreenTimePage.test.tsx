import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import {
  DailyScreenTimePage,
  DailyScreenTimeRow,
} from "@/components/settings/rows/screen-time/DailyScreenTimePage";
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

/** Types a whole code into the passcode boxes, the way a paste fills them. */
function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: code } });
}

function turnOn() {
  fireEvent.click(screen.getByRole("switch", { name: "Set daily screen time" }));
}

it("asks for a passcode the first time and saves it with the limit", async () => {
  const { account, update } = accountWith();
  const onLeave = vi.fn();
  render(<DailyScreenTimePage account={account} onLeave={onLeave} />);

  turnOn();
  fireEvent.click(screen.getByRole("button", { name: "1h 30m" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

  expect(screen.getByText("Create a passcode")).toBeTruthy();
  enterCode("1234");
  expect(screen.getByText("Confirm passcode")).toBeTruthy();
  enterCode("1234");

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      screenTimeLimitMinutes: 90,
      screenTimeLimitsByDay: null,
      screenTimePasscode: "1234",
    }),
  );
  await waitFor(() => expect(onLeave).toHaveBeenCalled());
});

it("does not save when the passcodes differ", () => {
  const { account, update } = accountWith();
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  turnOn();
  fireEvent.click(screen.getByRole("button", { name: "1h" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));
  enterCode("1234");
  enterCode("4321");

  expect(screen.getByText("Passcodes don't match")).toBeTruthy();
  expect(screen.getByText("Create a passcode")).toBeTruthy();
  expect(update).not.toHaveBeenCalled();
});

it("saves seven per-day limits", async () => {
  const { account, update } = accountWith({ hasScreenTimePasscode: true });
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  turnOn();
  fireEvent.click(screen.getByRole("radio", { name: "Set a custom limit per day" }));
  fireEvent.click(screen.getByRole("button", { name: "Tue limit" }));
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Hours" })).getByRole("option", { name: "2" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      screenTimeLimitMinutes: null,
      screenTimeLimitsByDay: [60, 120, 60, 60, 60, 60, 60],
    }),
  );
  expect(screen.queryByText("Create a passcode")).toBeNull();
});

it("turning off saves both shapes as null and asks for no passcode", async () => {
  const { account, update } = accountWith({ screenTimeLimitMinutes: 60 });
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  fireEvent.click(screen.getByRole("switch", { name: "Set daily screen time" }));
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      screenTimeLimitMinutes: null,
      screenTimeLimitsByDay: null,
    }),
  );
  expect(screen.queryByText("Create a passcode")).toBeNull();
});

it("picks a custom limit in hours and minutes, never under ten minutes", async () => {
  const { account, update } = accountWith({ hasScreenTimePasscode: true });
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  turnOn();
  fireEvent.click(screen.getByRole("button", { name: "Custom" }));
  fireEvent.click(screen.getByRole("button", { name: "Custom limit" }));
  const hours = screen.getByRole("listbox", { name: "Hours" });
  fireEvent.click(within(hours).getByRole("option", { name: "0" }));
  expect(screen.getByRole("button", { name: "Custom limit" }).textContent).toBe("10m");

  fireEvent.click(within(hours).getByRole("option", { name: "2" }));
  fireEvent.click(
    within(screen.getByRole("listbox", { name: "Minutes" })).getByRole("option", { name: "15" }),
  );
  fireEvent.click(screen.getByRole("button", { name: "Done" }));

  await waitFor(() =>
    expect(update).toHaveBeenCalledWith({
      screenTimeLimitMinutes: 135,
      screenTimeLimitsByDay: null,
    }),
  );
});

it("keeps Done disabled until a limit is chosen", () => {
  const { account } = accountWith();
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  turnOn();
  expect(screen.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "40m" }));
  expect(screen.getByRole("button", { name: "Done" }).hasAttribute("disabled")).toBe(false);
});

it("opens on a saved limit as it was set", () => {
  const { account } = accountWith({ screenTimeLimitMinutes: 75, hasScreenTimePasscode: true });
  render(<DailyScreenTimePage account={account} onLeave={() => {}} />);

  expect(screen.getByRole("switch", { name: "Set daily screen time" }).getAttribute("aria-checked")).toBe("true");
  expect(screen.getByRole("button", { name: "Custom" }).getAttribute("aria-pressed")).toBe("true");
  expect(screen.getByRole("button", { name: "Custom limit" }).textContent).toBe("1h 15m");
});

const row: SettingsRow = {
  kind: "value",
  title: "Daily screen time",
  description: "Get notified if you reach your time on Nowa.",
  value: "Off",
  action: "screen-time-limit",
};

it("shows today's limit on the row and opens the page", () => {
  const { account } = accountWith({ screenTimeLimitMinutes: 90 });
  const onOpen = vi.fn();
  render(<DailyScreenTimeRow row={row} account={account} onOpen={onOpen} />);

  expect(screen.getByText("1h 30m")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: /Daily screen time/ }));
  expect(onOpen).toHaveBeenCalled();
});
