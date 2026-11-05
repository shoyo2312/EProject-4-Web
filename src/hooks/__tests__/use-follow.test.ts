import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

import { useFollow } from "@/hooks/use-follow";
import type { FollowResponse } from "@/lib/api/types";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" }, requireSignIn: () => true }),
}));

const follow = vi.fn<(userId: string, sourceVideoId?: string) => Promise<FollowResponse>>(() =>
  Promise.resolve({ status: "FOLLOWING" } as FollowResponse),
);
vi.mock("@/lib/api/users", () => ({
  follow: (userId: string, sourceVideoId?: string) => follow(userId, sourceVideoId),
  unfollow: () => Promise.resolve(),
  isFollowing: () => Promise.resolve(false),
  peekFollowState: () => false,
  peekRequested: () => false,
  setFollowRequested: () => undefined,
  setFollowState: () => undefined,
  subscribeFollowState: () => () => undefined,
}));

afterEach(() => follow.mockClear());

describe("useFollow", () => {
  it("toggleSendsTheSourceVideo", () => {
    const { result } = renderHook(() => useFollow("2", false, { sourceVideoId: "42" }));

    act(() => result.current.toggle());

    expect(follow).toHaveBeenCalledWith("2", "42");
  });

  it("profileFollowSendsNoBody", () => {
    const { result } = renderHook(() => useFollow("2"));

    act(() => result.current.toggle());

    expect(follow).toHaveBeenCalledWith("2", undefined);
  });
});
