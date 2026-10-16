import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { SessionUser } from "@/components/session/SessionProvider";
import { AddEmailRow } from "@/components/settings/rows/AddEmailModal";
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
  addEmail: vi.fn(async () => ({ resendTicket: "resend-1" })),
  verifyEmail: vi.fn(async () => undefined),
  resendVerification: vi.fn(async () => ({ resendTicket: "resend-2" })),
}));

const session = {
  user: null as Partial<SessionUser> | null,
  reload: vi.fn(async () => undefined),
};
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => session }));

const row: SettingsRow = {
  kind: "link",
  title: "Add email address",
  description: "Needed to set a password.",
  action: "add-email",
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const renderFor = (user: Partial<SessionUser> | null) => {
  session.user = user;
  render(<AddEmailRow row={row} />);
};

async function sendTo(email: string) {
  fireEvent.click(screen.getByRole("button", { name: /Add email address/ }));
  fireEvent.change(screen.getByPlaceholderText("Email address"), { target: { value: email } });
  fireEvent.click(screen.getByRole("button", { name: "Solve the check" }));
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Send code" }));
  });
}

describe("AddEmailRow", () => {
  it("is shown only to a signed-in account with no address", () => {
    renderFor(null);
    expect(screen.queryByRole("button", { name: /Add email address/ })).toBeNull();
    cleanup();

    renderFor({ email: "jane@example.com" });
    expect(screen.queryByRole("button", { name: /Add email address/ })).toBeNull();
  });

  it("has no skip, unlike the step after login", () => {
    renderFor({ email: null });

    fireEvent.click(screen.getByRole("button", { name: /Add email address/ }));

    expect(screen.queryByRole("button", { name: "Skip for now" })).toBeNull();
  });

  it("mails a code to the address, confirms it, and re-reads the session", async () => {
    renderFor({ email: null });

    await sendTo("jane@example.com");
    expect(authApi.addEmail).toHaveBeenCalledWith("jane@example.com", "solved-token");

    await act(async () => {
      fireEvent.change(screen.getByLabelText("Digit 1"), { target: { value: "123456" } });
    });

    expect(authApi.verifyEmail).toHaveBeenCalledWith({ email: "jane@example.com", otp: "123456" });
    expect(session.reload).toHaveBeenCalled();
    expect(screen.queryByText("Enter 6-digit code")).toBeNull();
  });

  it("re-reads the session when closed after the address went through", async () => {
    renderFor({ email: null });

    await sendTo("jane@example.com");
    fireEvent.click(screen.getAllByRole("button", { name: "Close" }).at(-1)!);

    expect(session.reload).toHaveBeenCalled();
  });

  it("marks a taken address on the field and stays put", async () => {
    vi.mocked(authApi.addEmail).mockRejectedValueOnce(
      new ApiError(409, "EMAIL_ALREADY_EXISTS", "Email already exists"),
    );
    renderFor({ email: null });

    await sendTo("taken@example.com");

    expect(toast.error).toHaveBeenCalledWith("An account already exists for that email.");
    expect(screen.getByPlaceholderText("Email address").getAttribute("aria-invalid")).toBe("true");
    expect(screen.queryByText("Enter 6-digit code")).toBeNull();
  });
});
