import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { ProfileRouter } from "@/components/profile/ProfileRouter";

const openLogin = vi.fn();
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: null, isLoading: false, openLogin }),
}));

const getProfileByUsername = vi.fn();
vi.mock("@/lib/api/users", () => ({
  getProfileByUsername: (handle: string) => getProfileByUsername(handle),
}));

vi.mock("@/components/profile/BackendProfilePage", () => ({
  BackendProfilePage: () => <p>profile</p>,
}));

afterEach(cleanup);

describe("ProfileRouter for a guest", () => {
  it.each(["365050354607333376", "someone"])("asks %s's visitor to log in", (handle) => {
    render(<ProfileRouter handle={handle} />);

    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(openLogin).toHaveBeenCalled();
    expect(screen.queryByText("profile")).toBeNull();
    expect(getProfileByUsername).not.toHaveBeenCalled();
  });
});
