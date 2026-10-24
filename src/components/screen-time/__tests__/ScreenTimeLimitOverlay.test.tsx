import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { ScreenTimeLimitOverlay } from "@/components/screen-time/ScreenTimeLimitOverlay";
import { ApiError } from "@/lib/api/errors";
import { verifyScreenTimePasscode } from "@/lib/api/screen-time";

vi.mock("@/lib/api/screen-time", () => ({ verifyScreenTimePasscode: vi.fn() }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1", avatarUrl: "https://cdn.example.test/a.jpg" } }),
}));

afterEach(() => {
  cleanup();
  vi.mocked(verifyScreenTimePasscode).mockReset();
});

/** Types a whole code into the boxes, the way a paste fills them. */
function enterCode(code: string) {
  fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: code } });
}

it("shows Incorrect passcode on a wrong code and unlocks on the right one", async () => {
  vi.mocked(verifyScreenTimePasscode).mockImplementation(async (code) => code === "1234");
  const onUnlock = vi.fn();
  render(<ScreenTimeLimitOverlay onUnlock={onUnlock} />);

  expect(
    screen.getByRole("heading", { name: "You’ve reached your daily screen time limit" }),
  ).toBeTruthy();

  enterCode("1111");
  expect(await screen.findByText("Incorrect passcode")).toBeTruthy();
  expect(onUnlock).not.toHaveBeenCalled();

  enterCode("1234");
  await waitFor(() => expect(onUnlock).toHaveBeenCalled());
});

it("tells the passcode lockout from the gateway's rate limit", async () => {
  render(<ScreenTimeLimitOverlay onUnlock={() => {}} />);

  vi.mocked(verifyScreenTimePasscode).mockRejectedValueOnce(
    new ApiError(429, "TOO_MANY_PASSCODE_ATTEMPTS", "Too many wrong passcodes. Try again later."),
  );
  enterCode("1111");
  expect(
    await screen.findByText("Too many incorrect passcodes. Try again in 15 minutes."),
  ).toBeTruthy();

  vi.mocked(verifyScreenTimePasscode).mockRejectedValueOnce(
    new ApiError(429, null, "Too Many Requests"),
  );
  enterCode("2222");
  expect(await screen.findByText("Too many requests. Please slow down.")).toBeTruthy();
});
