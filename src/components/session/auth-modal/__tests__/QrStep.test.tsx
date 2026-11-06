import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { QrStep } from "@/components/session/auth-modal/QrStep";
import { createQrLogin, pollQrLogin } from "@/lib/api/auth";
import type { QrLoginStatusResponse } from "@/lib/api/types";

vi.mock("@/lib/api/auth", () => ({
  createQrLogin: vi.fn(),
  pollQrLogin: vi.fn(),
}));

const code = {
  qrId: "AbCdEfGhIjKlMnOpQrSt12",
  pollToken: "poll-secret",
  qrContent: "nowa://qr-login?id=AbCdEfGhIjKlMnOpQrSt12",
  expiresAt: new Date(Date.now() + 120_000).toISOString(),
};

const answer = (patch: Partial<QrLoginStatusResponse>): QrLoginStatusResponse => ({
  status: "PENDING",
  username: null,
  tokens: null,
  ...patch,
});

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.mocked(createQrLogin).mockResolvedValue({ ...code, expiresAt: new Date(Date.now() + 120_000).toISOString() });
  vi.mocked(pollQrLogin).mockResolvedValue(answer({}));
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.useRealTimers();
});

/** One poll interval, with its promise settled. */
const nextPoll = () => act(() => vi.advanceTimersByTimeAsync(2000));

describe("QrStep", () => {
  it("shows a code that carries only the id, never the poll token", async () => {
    const { container } = render(<QrStep onApproved={async () => undefined} />);
    await act(async () => undefined);

    expect(screen.getByLabelText("QR code to log in with the Nowa app")).toBeTruthy();
    expect(container.innerHTML).not.toContain("poll-secret");
  });

  it("says who scanned it, then signs in once the phone approves", async () => {
    const onApproved = vi.fn(async () => undefined);
    vi.mocked(pollQrLogin)
      .mockResolvedValueOnce(answer({ status: "SCANNED", username: "johndoe" }))
      .mockResolvedValueOnce(
        answer({
          status: "APPROVED",
          username: "johndoe",
          tokens: { accessToken: "a", refreshToken: "r", expiresInMillis: 900000 },
        }),
      );
    render(<QrStep onApproved={onApproved} />);
    await act(async () => undefined);

    await nextPoll();
    expect(screen.getByText("@johndoe")).toBeTruthy();
    expect(pollQrLogin).toHaveBeenCalledWith(code.qrId, "poll-secret");

    await nextPoll();
    expect(onApproved).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Logging in…")).toBeTruthy();
  });

  it("stops on a declined login and starts over with a fresh code on Refresh", async () => {
    vi.mocked(pollQrLogin).mockResolvedValueOnce(answer({ status: "REJECTED" }));
    render(<QrStep onApproved={async () => undefined} />);
    await act(async () => undefined);

    await nextPoll();
    expect(screen.getByText("Login declined")).toBeTruthy();
    await nextPoll();
    expect(pollQrLogin).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await act(async () => undefined);
    expect(createQrLogin).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText("QR code to log in with the Nowa app")).toBeTruthy();
  });

  it("greys out an unscanned code once it runs out, without waiting for the server", async () => {
    vi.mocked(createQrLogin).mockResolvedValue({ ...code, expiresAt: new Date(Date.now() + 1000).toISOString() });
    render(<QrStep onApproved={async () => undefined} />);
    await act(async () => undefined);

    await nextPoll();
    expect(screen.getByText("QR code expired")).toBeTruthy();
  });
});
