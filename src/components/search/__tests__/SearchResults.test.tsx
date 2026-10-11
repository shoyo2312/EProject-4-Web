import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SearchResults } from "@/components/search/SearchResults";

let params = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => params }));

let user: { userId: string } | null = null;
const requireSignIn = vi.fn();
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user, requireSignIn }),
}));

vi.mock("@/hooks/use-follow", () => ({
  useFollow: () => ({ isSelf: false, following: false, ready: true, toggle: () => {} }),
}));

const searchUsers = vi.fn();
vi.mock("@/lib/api/users", () => ({
  searchUsers: (...args: unknown[]) => searchUsers(...args),
}));

const searchVideos = vi.fn();
vi.mock("@/lib/api/search", () => ({
  searchVideos: (...args: unknown[]) => searchVideos(...args),
}));

afterEach(() => {
  cleanup();
  searchUsers.mockReset();
  searchVideos.mockReset();
});

describe("SearchResults' Accounts tab", () => {
  it("lists the matching accounts, and leaves the video search alone", async () => {
    params = new URLSearchParams("q=ann&tab=accounts");
    user = { userId: "1" };
    searchUsers.mockResolvedValue({
      content: [
        {
          userId: "42",
          username: "ann",
          displayName: "Ann",
          bio: null,
          avatarUrl: null,
          followerCount: 3,
          followingCount: 0,
        },
      ],
      page: { number: 0, size: 30, totalElements: 1, totalPages: 1 },
    });

    render(<SearchResults />);

    expect(await screen.findByText("Ann")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Accounts" }).getAttribute("aria-current")).toBe("page");
    expect(searchUsers).toHaveBeenCalledWith("ann", 30, expect.any(AbortSignal));
    expect(searchVideos).not.toHaveBeenCalled();
  });

  it("asks a guest to log in rather than searching", () => {
    params = new URLSearchParams("q=ann&tab=accounts");
    user = null;

    render(<SearchResults />);
    fireEvent.click(screen.getByRole("button", { name: "Log in" }));

    expect(requireSignIn).toHaveBeenCalled();
    expect(searchUsers).not.toHaveBeenCalled();
  });
});
