import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useFollowingAccounts } from "@/hooks/use-following-accounts";
import type { PageResponse, UserProfileResponse } from "@/lib/api/types";

let user: { userId: string } | null = { userId: "9" };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user }),
}));

const getFollowing =
  vi.fn<(userId: string, page: number, size: number) => Promise<PageResponse<UserProfileResponse>>>();
vi.mock("@/lib/api/users", () => ({
  getFollowing: (userId: string, page: number, size: number) => getFollowing(userId, page, size),
}));

const profile = (userId: string): UserProfileResponse => ({
  userId,
  username: "u" + userId,
  displayName: null,
  bio: null,
  avatarUrl: null,
  followerCount: 0,
  followingCount: 0,
});

const page = (ids: string[], number: number, totalPages: number): PageResponse<UserProfileResponse> => ({
  content: ids.map(profile),
  page: { size: 20, number, totalElements: 0, totalPages },
});

afterEach(() => {
  getFollowing.mockReset();
  user = { userId: "9" };
});

describe("useFollowingAccounts", () => {
  it("asks nothing while signed out", () => {
    user = null;
    const { result } = renderHook(() => useFollowingAccounts());

    expect(getFollowing).not.toHaveBeenCalled();
    expect(result.current.accounts).toEqual([]);
    expect(result.current.loadMore).toBeUndefined();
  });

  it("pages the viewer's list, drops repeats, and stops at the last page", async () => {
    getFollowing
      .mockResolvedValueOnce(page(["1", "2"], 0, 2))
      .mockResolvedValueOnce(page(["2", "3"], 1, 2));
    const { result } = renderHook(() => useFollowingAccounts());

    await waitFor(() => expect(result.current.accounts).toHaveLength(2));
    expect(getFollowing).toHaveBeenCalledWith("9", 0, 20);

    await act(async () => result.current.loadMore?.());

    expect(getFollowing).toHaveBeenLastCalledWith("9", 1, 20);
    expect(result.current.accounts.map((account) => account.userId)).toEqual(["1", "2", "3"]);
    expect(result.current.loadMore).toBeUndefined();
  });
});
