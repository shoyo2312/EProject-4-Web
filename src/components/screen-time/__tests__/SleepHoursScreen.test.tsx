import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SleepHoursScreen } from "@/components/screen-time/SleepHoursScreen";
import { toast } from "@/components/ui/toast";
import { playbackHeld } from "@/lib/playback-hold";

vi.mock("@/components/ui/toast", () => ({ toast: vi.fn() }));

const session = { user: { userId: "7", avatarUrl: "/a.png" } as { userId: string; avatarUrl: string } | null };
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => session }));

const account = { settings: { sleepHoursStart: "22:00" } as { sleepHoursStart: string | null } | null };
vi.mock("@/hooks/use-account-settings", () => ({
  useAccountSettings: () => ({ settings: account.settings, update: vi.fn() }),
}));

/** 2026-10-24 at the given wall-clock time, in the test machine's zone. */
const at = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(2026, 9, 24, hours, minutes);
};

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  session.user = { userId: "7", avatarUrl: "/a.png" };
  account.settings = { sleepHoursStart: "22:00" };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("SleepHoursScreen", () => {
  it("covers the app inside the viewer's sleep hours", () => {
    vi.setSystemTime(at("23:00"));
    render(<SleepHoursScreen />);
    expect(screen.getByRole("dialog", { name: "Sleep hours" })).toBeTruthy();
  });

  it("stays away outside them, signed out, or with sleep hours off", () => {
    vi.setSystemTime(at("21:00"));
    const { rerender } = render(<SleepHoursScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();

    vi.setSystemTime(at("23:00"));
    account.settings = { sleepHoursStart: null };
    rerender(<SleepHoursScreen key="off" />);
    expect(screen.queryByRole("dialog")).toBeNull();

    account.settings = { sleepHoursStart: "22:00" };
    session.user = null;
    rerender(<SleepHoursScreen key="signed-out" />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("comes up on its own when the window opens", () => {
    vi.setSystemTime(at("21:59"));
    render(<SleepHoursScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => vi.advanceTimersByTime(60_000));
    expect(screen.getByRole("dialog", { name: "Sleep hours" })).toBeTruthy();
  });

  it("Return for now hides it for an hour, across reloads", () => {
    vi.setSystemTime(at("23:00"));
    const { unmount } = render(<SleepHoursScreen />);
    fireEvent.click(screen.getByRole("button", { name: "Return for now" }));

    expect(screen.queryByRole("dialog")).toBeNull();
    expect(toast).toHaveBeenCalledWith("We’ll remind you again after 1 hour on Nowa");

    unmount();
    render(<SleepHoursScreen />);
    expect(screen.queryByRole("dialog")).toBeNull();

    act(() => vi.advanceTimersByTime(60 * 60_000));
    expect(screen.getByRole("dialog", { name: "Sleep hours" })).toBeTruthy();
  });

  it("holds every player while it covers the app, and stops media that starts behind it", () => {
    vi.setSystemTime(at("23:00"));
    render(<SleepHoursScreen />);
    expect(playbackHeld()).toBe(true);

    const video = document.createElement("video");
    document.body.append(video);
    const pause = vi.spyOn(video, "pause").mockImplementation(() => {});
    video.dispatchEvent(new Event("play"));
    expect(pause).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Return for now" }));
    expect(playbackHeld()).toBe(false);
    pause.mockClear();
    video.dispatchEvent(new Event("play"));
    expect(pause).not.toHaveBeenCalled();
    video.remove();
  });
});
