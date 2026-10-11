import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfileMoreMenu } from "@/components/profile/ProfileMoreMenu";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ requireSignIn: () => true }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const getMuted = vi.fn();
const unmute = vi.fn();
const block = vi.fn();
vi.mock("@/lib/api/users", () => ({
  getMuted: (...args: unknown[]) => getMuted(...args),
  mute: vi.fn(),
  unmute: (id: string) => unmute(id),
  block: (id: string) => block(id),
}));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("ProfileMoreMenu", () => {
  it("offers Unmute to someone already muted", async () => {
    getMuted.mockResolvedValue({ content: [{ userId: "7" }], page: {} });
    unmute.mockResolvedValue(undefined);
    render(<ProfileMoreMenu userId="7" name="Ann" />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "Unmute" }));

    expect(unmute).toHaveBeenCalledWith("7");
  });

  it("blocks only after the confirm, then leaves the profile", async () => {
    getMuted.mockResolvedValue({ content: [], page: {} });
    block.mockResolvedValue(undefined);
    render(<ProfileMoreMenu userId="7" name="Ann" />);

    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Block" }));
    expect(block).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Block" }));
    expect(block).toHaveBeenCalledWith("7");
    await waitFor(() => expect(replace).toHaveBeenCalledWith("/"));
  });
});
