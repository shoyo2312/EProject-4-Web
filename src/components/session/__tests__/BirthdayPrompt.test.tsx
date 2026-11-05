import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { BirthdayPrompt } from "@/components/session/BirthdayPrompt";

const session = { user: null as null | { profileReady: boolean; birthDate: string | null }, reload: vi.fn() };
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => session }));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const updateMyProfile = vi.fn<(patch: unknown) => Promise<unknown>>(() => Promise.resolve({}));
vi.mock("@/lib/api/users", () => ({ updateMyProfile: (patch: unknown) => updateMyProfile(patch) }));

beforeEach(() => {
  session.user = { profileReady: true, birthDate: null };
  session.reload = vi.fn(() => Promise.resolve());
});

afterEach(() => {
  cleanup();
  updateMyProfile.mockClear();
});

function pick(label: string, option: string) {
  fireEvent.click(screen.getByRole("button", { name: label }));
  fireEvent.click(screen.getByRole("option", { name: option }).querySelector("button")!);
}

describe("BirthdayPrompt", () => {
  it("asksWhenTheProfileHasNoBirthDate", () => {
    render(<BirthdayPrompt />);

    expect(screen.getByRole("dialog").textContent).toContain("When’s your birthday?");
  });

  it("staysQuietWhenItHasOne", () => {
    session.user = { profileReady: true, birthDate: "2001-05-09" };
    render(<BirthdayPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();

    session.user = { profileReady: false, birthDate: null };
    render(<BirthdayPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("submitsIsoAndReloads", async () => {
    render(<BirthdayPrompt />);

    pick("Month", "May");
    pick("Day", "9");
    pick("Year", "2001");
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));

    await waitFor(() => expect(updateMyProfile).toHaveBeenCalledWith({ birthDate: "2001-05-09" }));
    await waitFor(() => expect(session.reload).toHaveBeenCalled());
  });

  it("dismissStaysDismissedThisSession", () => {
    const { rerender } = render(<BirthdayPrompt />);

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    rerender(<BirthdayPrompt />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
