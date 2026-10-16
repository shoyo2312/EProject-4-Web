import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/components/session/SessionProvider";
import { PasswordRow } from "@/components/settings/rows/PasswordModal";
import { toast } from "@/components/ui/toast";
import * as authApi from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import type { SettingsRow } from "@/types/tiktok";

vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("solved-token")}>
      Solve the check
    </button>
  ),
}));

vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("@/lib/api/auth", () => ({
  forgotPassword: vi.fn(async () => ({ resendTicket: "resend-1" })),
  verifyPasswordReset: vi.fn(async () => ({ resetToken: "reset-1", expiresInMillis: 900_000 })),
  completePasswordReset: vi.fn(async () => undefined),
}));

const session = {
  user: null as Partial<SessionUser> | null,
  requireSignIn: vi.fn(() => true),
  signIn: vi.fn(async () => undefined),
  signOut: vi.fn(async () => undefined),
};
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => session }));

const row: SettingsRow = {
  kind: "link",
  title: "Change password",
  description: "Choose a new password.",
  action: "password",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderFor = (user: Partial<SessionUser> | null) => {
  session.user = user;
  render(<PasswordRow row={row} />);
};

async function openAndVerify(rowName: RegExp) {
  fireEvent.click(screen.getByRole("button", { name: rowName }));
  fireEvent.click(screen.getByRole("button", { name: "Solve the check" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  });
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: "123456" } });
  });
}

async function submitPassword(label: string) {
  fireEvent.change(await screen.findByPlaceholderText("New password"), {
    target: { value: "Str0ng-pass!" },
  });
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: label }));
  });
}

describe("PasswordRow", () => {
  it("offers Change password to an account that has one, and to a signed-out viewer", () => {
    renderFor({ email: "jane@example.com", hasPassword: true });
    expect(screen.getByRole("button", { name: /Change password/ })).toBeTruthy();
    cleanup();

    renderFor(null);
    expect(screen.getByRole("button", { name: /Change password/ })).toBeTruthy();
  });

  it("offers Set password to a social account with none", () => {
    renderFor({ email: "jane@example.com", hasPassword: false });

    expect(screen.getByRole("button", { name: /Set password/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Change password/ })).toBeNull();
  });

  it("asks for an email first when the account has none", () => {
    renderFor({ email: null, hasPassword: false });

    expect(screen.getByRole<HTMLButtonElement>("button", { name: /Set password/ }).disabled).toBe(true);
    expect(screen.getByText("Add an email address to your account first.")).toBeTruthy();
  });

  it("checks the code before asking for a password, then sets it and signs back in", async () => {
    renderFor({ email: "jane@example.com", hasPassword: false });

    await openAndVerify(/Set password/);

    expect(authApi.forgotPassword).toHaveBeenCalledWith("jane@example.com", { turnstileToken: "solved-token" });
    expect(authApi.verifyPasswordReset).toHaveBeenCalledWith("jane@example.com", "123456");

    await submitPassword("Set password");

    expect(authApi.completePasswordReset).toHaveBeenCalledWith({
      resetToken: "reset-1",
      newPassword: "Str0ng-pass!",
    });
    await waitFor(() => expect(session.signIn).toHaveBeenCalledWith("jane@example.com", "Str0ng-pass!", { quiet: true }));
    expect(toast.success).toHaveBeenCalledWith("Password set.");
  });

  it("changes an existing password through the same code", async () => {
    renderFor({ email: "jane@example.com", hasPassword: true });

    await openAndVerify(/Change password/);
    await submitPassword("Change password");

    expect(authApi.completePasswordReset).toHaveBeenCalledWith({
      resetToken: "reset-1",
      newPassword: "Str0ng-pass!",
    });
    await waitFor(() => expect(session.signIn).toHaveBeenCalledWith("jane@example.com", "Str0ng-pass!", { quiet: true }));
    expect(toast.success).toHaveBeenCalledWith("Password changed.");
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("stays on the code step for a wrong code", async () => {
    vi.mocked(authApi.verifyPasswordReset).mockRejectedValueOnce(
      new ApiError(400, "INVALID_OTP", "Invalid OTP"),
    );
    renderFor({ email: "jane@example.com", hasPassword: true });

    await openAndVerify(/Change password/);

    expect(screen.queryByPlaceholderText("New password")).toBeNull();
    expect(screen.getByText("Enter 6-digit code")).toBeTruthy();
  });
});
