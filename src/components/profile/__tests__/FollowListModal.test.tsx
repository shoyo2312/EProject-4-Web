import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { FollowListModal } from "@/components/profile/FollowListModal";
import type { SuggestedAccountResponse } from "@/lib/api/types";

const getSuggestedAccounts = vi.fn<(limit: number) => Promise<SuggestedAccountResponse[]>>();
vi.mock("@/lib/api/users", () => ({
  getSuggestedAccounts: (limit: number) => getSuggestedAccounts(limit),
  setFollowState: vi.fn(),
}));
vi.mock("@/hooks/use-follow", () => ({
  useFollow: () => ({ isSelf: false, following: false, requested: false, ready: true, toggle: vi.fn() }),
}));
vi.mock("@/components/stories/StoryAvatar", () => ({
  StoryAvatar: ({ children }: { children: ReactNode }) => <>{children}</>,
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
  cleanup();
  getSuggestedAccounts.mockReset();
});

describe("FollowListModal", () => {
  it("lists the viewer's suggestions without the profile's owner", async () => {
    getSuggestedAccounts.mockResolvedValue([suggestion(7), suggestion(9)]);
    render(
      <FollowListModal
        targetUserId="7"
        initialTab="suggested"
        followerCount={0}
        followingCount={0}
        onClose={vi.fn()}
      />,
    );

    expect(await screen.findByText("User 9")).toBeTruthy();
    expect(screen.queryByText("User 7")).toBeNull();
  });
});
