import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReactivateStep } from "@/components/session/auth-modal/ReactivateStep";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";

vi.mock("@/components/ui/toast", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ReactivateStep", () => {
  it("says a pending deletion is cancelled by reactivating", () => {
    render(<ReactivateStep deletionPending onReactivate={vi.fn()} onCancel={vi.fn()} />);

    expect(screen.getByText(/cancel the deletion/)).toBeTruthy();
  });

  it("reopens the account with the credential already given", async () => {
    const onReactivate = vi.fn().mockResolvedValue(undefined);
    render(<ReactivateStep deletionPending={false} onReactivate={onReactivate} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(onReactivate).toHaveBeenCalledTimes(1));
  });

  it("keeps the step up after a refusal, so it can be tried again", async () => {
    const onReactivate = vi.fn().mockRejectedValue(new ApiError(503, null, "down"));
    render(<ReactivateStep deletionPending={false} onReactivate={onReactivate} onCancel={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Reactivate" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect((screen.getByRole("button", { name: "Reactivate" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("leaves the account closed on Not now", () => {
    const onCancel = vi.fn();
    const onReactivate = vi.fn();
    render(<ReactivateStep deletionPending={false} onReactivate={onReactivate} onCancel={onCancel} />);

    fireEvent.click(screen.getByRole("button", { name: "Not now" }));

    expect(onCancel).toHaveBeenCalled();
    expect(onReactivate).not.toHaveBeenCalled();
  });
});
