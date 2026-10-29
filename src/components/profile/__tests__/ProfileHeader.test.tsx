import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentProps } from "react";

import { ProfileHeader } from "@/components/profile/ProfileHeader";
import type { UserProfile } from "@/types/tiktok";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/stories/ProfileStoryAvatar", () => ({
  ProfileStoryAvatar: () => null,
}));
vi.mock("@/components/profile/ProfileMoreMenu", () => ({
  ProfileMoreMenu: () => null,
}));

const visitor: UserProfile = {
  author: { userId: "42", username: "42", handle: "someone", nickname: "Someone", avatarUrl: "" },
  isVerified: false,
  bio: "",
  stats: { following: 0, followers: 0, likes: 0 },
  isFollowing: false,
  posts: { videos: [], reposts: [], favorites: [], liked: [] },
};

function header(overrides: Partial<ComponentProps<typeof ProfileHeader>>) {
  return (
    <ProfileHeader
      profile={visitor}
      isOwner={false}
      requireSignIn={() => true}
      onEditProfile={() => {}}
      onToggleFollow={async () => "FOLLOWING"}
      onOpenFollowers={() => {}}
      onOpenFollowing={() => {}}
      suggestedOpen={false}
      onToggleSuggested={() => {}}
      {...overrides}
    />
  );
}

afterEach(cleanup);

describe("ProfileHeader", () => {
  it("toggles the suggested accounts for a signed-in visitor", () => {
    const onToggleSuggested = vi.fn();
    const { rerender } = render(
      header({ requireSignIn: () => true, suggestedOpen: false, onToggleSuggested }),
    );
    const button = screen.getByRole("button", { name: "Suggested accounts" });

    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-controls")).toBe("suggested-accounts");
    fireEvent.click(button);
    expect(onToggleSuggested).toHaveBeenCalledTimes(1);

    rerender(header({ requireSignIn: () => true, suggestedOpen: true, onToggleSuggested }));
    expect(button.getAttribute("aria-expanded")).toBe("true");
  });

  it("asks a guest to sign in instead", () => {
    const onToggleSuggested = vi.fn();
    render(header({ requireSignIn: () => false, suggestedOpen: false, onToggleSuggested }));
    fireEvent.click(screen.getByRole("button", { name: "Suggested accounts" }));
    expect(onToggleSuggested).not.toHaveBeenCalled();
  });
});
