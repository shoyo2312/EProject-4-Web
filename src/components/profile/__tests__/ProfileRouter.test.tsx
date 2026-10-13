import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ProfileRouter } from "@/components/profile/ProfileRouter";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: null, isLoading: false }),
}));

const getProfileByUsername = vi.fn();
vi.mock("@/lib/api/users", () => ({
  getProfileByUsername: (handle: string) => getProfileByUsername(handle),
}));

vi.mock("@/components/profile/BackendProfilePage", () => ({
  BackendProfilePage: ({ userId }: { userId?: string }) => <p>profile {userId}</p>,
}));

afterEach(() => {
  cleanup();
  getProfileByUsername.mockReset();
});

describe("ProfileRouter for a guest", () => {
  it("opens a profile addressed by id without a lookup", () => {
    render(<ProfileRouter handle="365050354607333376" />);

    expect(screen.getByText("profile 365050354607333376")).toBeTruthy();
    expect(getProfileByUsername).not.toHaveBeenCalled();
  });

  it("resolves a handle to its account", async () => {
    getProfileByUsername.mockResolvedValue({ userId: "42" });

    render(<ProfileRouter handle="someone" />);

    expect(await screen.findByText("profile 42")).toBeTruthy();
    expect(getProfileByUsername).toHaveBeenCalledWith("someone");
  });
});
