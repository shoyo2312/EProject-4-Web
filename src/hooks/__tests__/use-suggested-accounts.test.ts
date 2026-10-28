import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useSuggestedAccounts } from "@/hooks/use-suggested-accounts";
import type { SuggestedAccountResponse } from "@/lib/api/types";

const getSuggestedAccounts =
  vi.fn<(limit: number, signal?: AbortSignal) => Promise<SuggestedAccountResponse[]>>();
const setFollowState = vi.fn<(userId: string, value: boolean) => void>();
vi.mock("@/lib/api/users", () => ({
  getSuggestedAccounts: (limit: number, signal?: AbortSignal) => getSuggestedAccounts(limit, signal),
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
    expect(getSuggestedAccounts).toHaveBeenCalledWith(21, expect.any(AbortSignal));
  });

  it("leavesOutTheExcludedAccountAndKeepsTwenty", async () => {
    getSuggestedAccounts.mockResolvedValue(Array.from({ length: 21 }, (_, i) => suggestion(i + 1)));
    const { result } = renderHook(() => useSuggestedAccounts(true, "5"));
    await waitFor(() => expect(result.current.accounts).toHaveLength(20));

    expect(result.current.accounts.map((a) => a.author.userId)).not.toContain("5");
    expect(result.current.accounts[0].label).toBe("Suggested for you");
  });

  it("aborts the request when it unmounts mid-flight", () => {
    getSuggestedAccounts.mockReturnValue(new Promise(() => {}));
    const { unmount } = renderHook(() => useSuggestedAccounts(true));
    const signal = getSuggestedAccounts.mock.calls[0][1];

    expect(signal?.aborted).toBe(false);
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it("tells the follow cache that none of them is followed", async () => {
    getSuggestedAccounts.mockResolvedValue([suggestion(1), suggestion(2)]);
    const { result } = renderHook(() => useSuggestedAccounts(true));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(setFollowState).toHaveBeenCalledWith("1", false);
    expect(setFollowState).toHaveBeenCalledWith("2", false);
  });
});
