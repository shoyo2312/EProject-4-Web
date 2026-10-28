import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useSuggestedAccounts } from "@/hooks/use-suggested-accounts";
import type { SuggestedAccountResponse } from "@/lib/api/types";

const getSuggestedAccounts = vi.fn<(limit: number) => Promise<SuggestedAccountResponse[]>>();
const setFollowState = vi.fn<(userId: string, value: boolean) => void>();
vi.mock("@/lib/api/users", () => ({
  getSuggestedAccounts: (limit: number) => getSuggestedAccounts(limit),
  setFollowState: (userId: string, value: boolean) => setFollowState(userId, value),
}));

const suggestion = (id: number): SuggestedAccountResponse => ({
  profile: {
    userId: String(id),
    username: `u${id}`,
    displayName: `User ${id}`,
    bio: null,
    avatarUrl: null,
    followerCount: 0,
    followingCount: 0,
  },
  reason: "POPULAR",
  followedBy: null,
});

afterEach(() => {
  getSuggestedAccounts.mockReset();
  setFollowState.mockReset();
});

describe("useSuggestedAccounts", () => {
  it("does not ask before it is first enabled", () => {
    renderHook(() => useSuggestedAccounts(false));
    expect(getSuggestedAccounts).not.toHaveBeenCalled();
  });

  it("asksOnceForOneMoreThanItShows", async () => {
    getSuggestedAccounts.mockResolvedValue([suggestion(1)]);
    const { result, rerender } = renderHook(({ on }) => useSuggestedAccounts(on), {
      initialProps: { on: false },
    });
    rerender({ on: true });
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    rerender({ on: false });
    rerender({ on: true });

    expect(getSuggestedAccounts).toHaveBeenCalledTimes(1);
    expect(getSuggestedAccounts).toHaveBeenCalledWith(21);
  });

  it("leavesOutTheExcludedAccountAndKeepsTwenty", async () => {
    getSuggestedAccounts.mockResolvedValue(Array.from({ length: 21 }, (_, i) => suggestion(i + 1)));
    const { result } = renderHook(() => useSuggestedAccounts(true, "5"));
    await waitFor(() => expect(result.current.accounts).toHaveLength(20));

    expect(result.current.accounts.map((a) => a.author.userId)).not.toContain("5");
    expect(result.current.accounts[0].label).toBe("Suggested for you");
  });

  it("tells the follow cache that none of them is followed", async () => {
    getSuggestedAccounts.mockResolvedValue([suggestion(1), suggestion(2)]);
    const { result } = renderHook(() => useSuggestedAccounts(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(setFollowState).toHaveBeenCalledWith("1", false);
    expect(setFollowState).toHaveBeenCalledWith("2", false);
  });
});
