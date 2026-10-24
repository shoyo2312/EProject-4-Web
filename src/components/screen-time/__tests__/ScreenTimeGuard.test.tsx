import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";

import { ScreenTimeGuard } from "@/components/screen-time/ScreenTimeGuard";
import { toast } from "@/components/ui/toast";
import type { UserSettingsResponse } from "@/lib/api/types";
import {
  getScreenTimeWeek,
  sendScreenTimeHeartbeat,
  verifyScreenTimePasscode,
} from "@/lib/api/screen-time";
import { DEFAULT_SETTINGS } from "@/lib/settings/__tests__/user-settings-fixture";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1", avatarUrl: "https://cdn.example.test/a.jpg" } }),
}));
vi.mock("@/lib/api/screen-time", () => ({
  sendScreenTimeHeartbeat: vi.fn(async () => {}),
  getScreenTimeWeek: vi.fn(),
  verifyScreenTimePasscode: vi.fn(),
}));
let settings: UserSettingsResponse = DEFAULT_SETTINGS;
vi.mock("@/hooks/use-account-settings", () => ({
  useAccountSettings: () => ({ settings, update: vi.fn() }),
}));
let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

/** Wednesday 21 October 2026, at noon. */
const wednesdayNoon = new Date(2026, 9, 21, 12);

/** The week of 19 October with `seconds` of day time on the Wednesday. */
function weekWith(seconds: number) {
  const days = [19, 20, 21, 22, 23, 24, 25].map((date) => ({
    date: `2026-10-${date}`,
    daySeconds: date === 21 ? seconds : 0,
    nightSeconds: 0,
  }));
  return { weekStart: "2026-10-19", days };
}

const LIMIT_HEADING = { name: "You’ve reached your daily screen time limit" };

const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
let visible = true;
let focus: MockInstance;

beforeEach(() => {
  vi.useFakeTimers();
  focus = vi.spyOn(document, "hasFocus").mockReturnValue(true);
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    get: () => (visible ? "visible" : "hidden"),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  focus.mockRestore();
  Reflect.deleteProperty(document, "visibilityState");
  visible = true;
  settings = DEFAULT_SETTINGS;
  pathname = "/";
  localStorage.clear();
  vi.mocked(sendScreenTimeHeartbeat).mockReset();
  vi.mocked(getScreenTimeWeek).mockReset();
  vi.mocked(verifyScreenTimePasscode).mockReset();
  vi.mocked(toast).mockReset();
});

it("sends 60 seconds after four visible, focused ticks", () => {
  render(<ScreenTimeGuard />);

  act(() => vi.advanceTimersByTime(45_000));
  expect(sendScreenTimeHeartbeat).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(15_000));
  expect(sendScreenTimeHeartbeat).toHaveBeenCalledWith(60, zone);
});

it("counts nothing while the tab is hidden", () => {
  visible = false;
  render(<ScreenTimeGuard />);

  act(() => vi.advanceTimersByTime(120_000));

  expect(sendScreenTimeHeartbeat).not.toHaveBeenCalled();
});

it("keeps the seconds a failed send carried, never more than 120", async () => {
  vi.mocked(sendScreenTimeHeartbeat).mockRejectedValue(new Error("offline"));
  const sent = () => vi.mocked(sendScreenTimeHeartbeat).mock.calls.map(([seconds]) => seconds);
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(75_000));
  expect(sent()).toEqual([60, 75]);

  await act(() => vi.advanceTimersByTimeAsync(120_000));
  expect(Math.max(...sent())).toBe(120);
  expect(sent().at(-1)).toBe(120);
});

it("covers the app once today's time reaches the limit, until the passcode is entered", async () => {
  vi.setSystemTime(wednesdayNoon);
  settings = { ...DEFAULT_SETTINGS, screenTimeLimitMinutes: 10, hasScreenTimePasscode: true };
  vi.mocked(getScreenTimeWeek).mockResolvedValue(weekWith(590));
  vi.mocked(verifyScreenTimePasscode).mockResolvedValue(true);
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(getScreenTimeWeek).toHaveBeenCalledWith("2026-10-19");
  expect(screen.queryByRole("heading", LIMIT_HEADING)).toBeNull();

  // Fifteen more seconds on the site: 605 of the 600 allowed.
  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(screen.getByRole("heading", LIMIT_HEADING)).toBeTruthy();

  fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: "1234" } });
  await act(() => vi.advanceTimersByTimeAsync(0));
  expect(screen.queryByRole("heading", LIMIT_HEADING)).toBeNull();
  expect(localStorage.getItem("nowa:screen-time-unlocked:1")).toBe("2026-10-21");
});

it("leaves /setting uncovered, so the limit can be changed", async () => {
  vi.setSystemTime(wednesdayNoon);
  pathname = "/setting";
  settings = { ...DEFAULT_SETTINGS, screenTimeLimitMinutes: 10, hasScreenTimePasscode: true };
  vi.mocked(getScreenTimeWeek).mockResolvedValue(weekWith(900));
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(screen.queryByRole("heading", LIMIT_HEADING)).toBeNull();
});

it("reads no week for an account without a limit", async () => {
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(15_000));
  expect(getScreenTimeWeek).not.toHaveBeenCalled();
});

it("reminds ten minutes before sleep hours and at their start, once each", async () => {
  vi.setSystemTime(new Date(2026, 9, 21, 21, 49, 50));
  settings = { ...DEFAULT_SETTINGS, sleepHoursStart: "22:00", sleepHoursEnd: "06:00" };
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(15_000)); // 21:50:05
  expect(toast).toHaveBeenCalledWith("Sleep hours start in 10 minutes");

  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(toast).toHaveBeenCalledTimes(1);

  await act(() => vi.advanceTimersByTimeAsync(9 * 60_000)); // 22:00:05
  expect(toast).toHaveBeenLastCalledWith("Your sleep hours have started");
  expect(toast).toHaveBeenCalledTimes(2);
  expect(localStorage.getItem("nowa:sleep-reminder:1:2026-10-21:soon")).not.toBeNull();
});

it("does not repeat a reminder this browser already showed for the night", async () => {
  vi.setSystemTime(new Date(2026, 9, 21, 21, 55));
  settings = { ...DEFAULT_SETTINGS, sleepHoursStart: "22:00", sleepHoursEnd: "06:00" };
  localStorage.setItem("nowa:sleep-reminder:1:2026-10-21:soon", "1");
  render(<ScreenTimeGuard />);

  await act(() => vi.advanceTimersByTimeAsync(60_000));
  expect(toast).not.toHaveBeenCalled();
});
