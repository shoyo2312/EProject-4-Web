import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";

import { ProfileBody } from "@/components/profile/ProfileBody";
import type { UserProfile } from "@/types/tiktok";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/@someone",
  useSearchParams: () => new URLSearchParams(),
}));

vi.stubGlobal(
  "ResizeObserver",
  class {
    observe() {}
    disconnect() {}
  },
);

afterEach(cleanup);

function profile(postsLocked: boolean): UserProfile {
  return {
    author: {
      userId: "42",
      username: "someone",
      handle: "someone",
      nickname: "Someone",
      avatarUrl: "",
    },
    isVerified: false,
    bio: "",
    stats: { following: 0, followers: 0, likes: 0 },
    isFollowing: false,
    postsLocked,
    posts: { videos: [], reposts: [], favorites: [], liked: [] },
  } as UserProfile;
}

describe("ProfileBody", () => {
  it("says the account is private instead of drawing tabs and an empty grid", () => {
    render(<ProfileBody profile={profile(true)} isOwner={false} />);

    expect(screen.getByText("This account is private")).toBeTruthy();
    expect(screen.queryByRole("tab")).toBeNull();
  });

  it("keeps the tabs for an account the viewer may open", () => {
    render(<ProfileBody profile={profile(false)} isOwner={false} />);

    expect(screen.queryByText("This account is private")).toBeNull();
    expect(screen.getAllByRole("tab").length).toBeGreaterThan(0);
  });
});
