import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi, type MockInstance } from "vitest";

import { ScreenTimeGuard } from "@/components/screen-time/ScreenTimeGuard";
import { sendScreenTimeHeartbeat } from "@/lib/api/screen-time";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));
vi.mock("@/lib/api/screen-time", () => ({ sendScreenTimeHeartbeat: vi.fn(async () => {}) }));

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
  vi.mocked(sendScreenTimeHeartbeat).mockReset();
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
