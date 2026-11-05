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

const getUserVideos = vi.fn();
const getUserVideoStats = vi.fn();
vi.mock("@/lib/api/videos", () => ({
  getUserVideos: (...args: unknown[]) => getUserVideos(...args),
  getUserVideoStats: (...args: unknown[]) => getUserVideoStats(...args),
}));

vi.mock("@/lib/api/authors", () => ({
  resolveAuthors: async () =>
    new Map([
      [
        "42",
        { userId: "42", username: "42", handle: "ann", nickname: "Ann", avatarUrl: null },
      ],
    ]),
}));

const ann = {
  userId: "42",
  username: "ann",
  displayName: "Ann",
  bio: null,
  avatarUrl: null,
  followerCount: 3,
  followingCount: 0,
};
const onePage = <T,>(content: T[]) => ({
  content,
  page: { number: 0, size: 30, totalElements: content.length, totalPages: 1 },
});
const video = {
  id: "7",
  userId: "42",
  title: "Ann dances",
  description: null,
  thumbnailUrl: null,
  status: "PUBLISHED",
  tags: [],
  viewCount: 414,
  likeCount: 0,
  commentCount: 0,
  shareCount: 0,
  createdAt: new Date().toISOString(),
};

afterEach(() => {
  cleanup();
  searchUsers.mockReset();
  searchVideos.mockReset();
  getUserVideos.mockReset();
  getUserVideoStats.mockReset();
});

describe("SearchResults' Top tab", () => {
  it("leads with the best-matching account and their videos, then the first videos", async () => {
    params = new URLSearchParams("q=ann");
    user = { userId: "1" };
    searchUsers.mockResolvedValue(onePage([ann]));
    getUserVideoStats.mockResolvedValue({ userId: "42", videoCount: 1, totalLikes: 1200, totalViews: 0 });
    getUserVideos.mockResolvedValue(onePage([{ id: "9", thumbnailUrl: null }]));
    searchVideos.mockResolvedValue(onePage([video]));

    render(<SearchResults />);

    expect(await screen.findByText("3 Followers · 1200 Likes")).not.toBeNull();
    expect(await screen.findByText("Ann dances")).not.toBeNull();
    expect(screen.getByRole("link", { name: "Top" }).getAttribute("aria-current")).toBe("page");
    expect(searchUsers).toHaveBeenCalledWith("ann", 1, expect.any(AbortSignal));
    expect(getUserVideos).toHaveBeenCalledWith("42", 0, 10, expect.any(AbortSignal));
    expect(searchVideos).toHaveBeenCalledWith("ann", 0, 12, expect.any(AbortSignal));
    // The Top tab's video block is a teaser; the full list is one tab over.
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("skips the account section for a guest instead of asking them to log in", async () => {
    params = new URLSearchParams("q=ann");
    user = null;
    searchVideos.mockResolvedValue(onePage([video]));

    render(<SearchResults />);

    expect(await screen.findByText("Ann dances")).not.toBeNull();
    expect(searchUsers).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Log in" })).toBeNull();
  });
});

describe("SearchResults' Accounts tab", () => {
  it("lists the matching accounts, and leaves the video search alone", async () => {
    params = new URLSearchParams("q=ann&tab=accounts");
    user = { userId: "1" };
    searchUsers.mockResolvedValue(onePage([ann]));

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

describe("SearchResults' Videos tab", () => {
  it("pages the full video result set and offers Load more", async () => {
    params = new URLSearchParams("q=ann&tab=videos");
    user = null;
    searchVideos.mockResolvedValue({
      content: [video],
      page: { number: 0, size: 24, totalElements: 30, totalPages: 2 },
    });

    render(<SearchResults />);

    expect(await screen.findByText("Ann dances")).not.toBeNull();
    expect(searchVideos).toHaveBeenCalledWith("ann", 0, 24, expect.any(AbortSignal));
    expect(screen.getByRole("button", { name: "Load more" })).not.toBeNull();
    expect(searchUsers).not.toHaveBeenCalled();
  });
});
