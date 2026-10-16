import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CodeStep } from "@/components/session/auth-modal/CodeStep";
import { toast } from "@/components/ui/toast";
import type { SendProof } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/errors";
import type { OtpSentResponse } from "@/lib/api/types";

// Cloudflare's widget, reduced to the one thing the step needs from it: a token.
vi.mock("@/components/auth/TurnstileWidget", () => ({
  TurnstileWidget: ({ onVerify }: { onVerify: (token: string) => void }) => (
    <button type="button" onClick={() => onVerify("solved-token")}>
      Solve the check
    </button>
  ),
}));

vi.mock("@/components/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

type Resend = (proof: SendProof) => Promise<OtpSentResponse>;

const renderStep = (props: { resendTicket?: string | null; onResend: Resend }) =>
  render(<CodeStep email="viewer@example.com" onSubmit={async () => undefined} {...props} />);

const resendButton = () => screen.getByRole("button", { name: "Resend code" });
const check = () => screen.queryByRole("button", { name: "Solve the check" });

describe("CodeStep resend", () => {
  it("resends on the ticket it was handed, with no Turnstile check", async () => {
    const onResend = vi.fn<Resend>(async () => ({ resendTicket: "ticket-1" }));
    renderStep({ resendTicket: "ticket-1", onResend });

    fireEvent.click(resendButton());

    await waitFor(() => expect(onResend).toHaveBeenCalledWith({ resendTicket: "ticket-1" }));
    expect(check()).toBeNull();
  });

  it("puts up the check when the server refuses the ticket, and resends once it is solved", async () => {
    const onResend = vi
      .fn<Resend>()
      .mockRejectedValueOnce(
        new ApiError(403, "TURNSTILE_VERIFICATION_FAILED", "Turnstile verification required or failed"),
      )
      .mockResolvedValueOnce({ resendTicket: "ticket-2" });
    renderStep({ resendTicket: "ticket-1", onResend });

    fireEvent.click(resendButton());
    fireEvent.click(await screen.findByRole("button", { name: "Solve the check" }));

    await waitFor(() => expect(onResend).toHaveBeenLastCalledWith({ turnstileToken: "solved-token" }));
    expect(onResend).toHaveBeenCalledTimes(2);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("asks for the check when it has no ticket, then resends on the one that earns", async () => {
    vi.useFakeTimers();
    const onResend = vi.fn<Resend>(async () => ({ resendTicket: "ticket-2" }));
    renderStep({ onResend });

    fireEvent.click(resendButton());
    expect(onResend).not.toHaveBeenCalled();

    fireEvent.click(check()!);
    await act(async () => {});
    expect(onResend).toHaveBeenLastCalledWith({ turnstileToken: "solved-token" });

    // The 60-second cooldown, a tick at a time as the step counts it down.
    for (let second = 0; second < 60; second++) {
      act(() => {
        vi.advanceTimersByTime(1000);
      });
    }
    fireEvent.click(resendButton());
    await act(async () => {});

    expect(onResend).toHaveBeenLastCalledWith({ resendTicket: "ticket-2" });
    expect(check()).toBeNull();
  });

  it("reads Sending… through the check and the request, then Resend code again", async () => {
    let answer: (sent: OtpSentResponse) => void = () => undefined;
    const onResend = vi.fn<Resend>(() => new Promise((resolve) => (answer = resolve)));
    renderStep({ onResend });

    fireEvent.click(resendButton());
    expect(screen.getByRole("button", { name: "Sending…" })).toHaveProperty("disabled", true);

    fireEvent.click(check()!);
    expect(screen.getByRole("button", { name: "Sending…" })).toHaveProperty("disabled", true);

    await act(async () => answer({ resendTicket: "ticket-2" }));
    expect(resendButton()).toHaveProperty("disabled", true);
    expect(screen.queryByRole("button", { name: "Sending…" })).toBeNull();
  });
});
