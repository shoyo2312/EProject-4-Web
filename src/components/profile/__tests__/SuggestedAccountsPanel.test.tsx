import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";

import { SuggestedAccountsPanel } from "@/components/profile/SuggestedAccountsPanel";
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

describe("SuggestedAccountsPanel", () => {
  it("staysInertAndSilentWhileClosed", () => {
    const { container } = render(
      <SuggestedAccountsPanel open={false} excludeUserId="7" onViewAll={vi.fn()} />,
    );
    expect(container.querySelector("#suggested-accounts")?.hasAttribute("inert")).toBe(true);
    expect(getSuggestedAccounts).not.toHaveBeenCalled();
  });

  it("shows each suggestion with its reason and a Follow button", async () => {
    getSuggestedAccounts.mockResolvedValue([
      { ...suggestion(9), reason: "FOLLOWED_BY", followedBy: "Ann" },
      suggestion(7),
    ]);
    render(<SuggestedAccountsPanel open excludeUserId="7" onViewAll={vi.fn()} />);

    expect(await screen.findByText("Followed by Ann")).toBeTruthy();
    expect(screen.queryByText("User 7")).toBeNull();
    expect(screen.getAllByRole("button", { name: "Follow" })).toHaveLength(1);
  });

  it("explains where suggestions come from on hover", async () => {
    getSuggestedAccounts.mockResolvedValue([]);
    render(<SuggestedAccountsPanel open excludeUserId="7" onViewAll={vi.fn()} />);
    fireEvent.mouseEnter(screen.getByText("Suggested accounts"));
    expect(screen.getByRole("tooltip").textContent).toBe(
      "Suggestions come from your connections: people who follow you, and people followed by accounts you follow. Your account can be suggested to others the same way.",
    );
  });

  it("reaches the explanation from the keyboard too", () => {
    getSuggestedAccounts.mockResolvedValue([]);
    render(<SuggestedAccountsPanel open excludeUserId="7" onViewAll={vi.fn()} />);
    const label = screen.getByText("Suggested accounts").closest("[tabindex]");

    expect(label?.getAttribute("tabindex")).toBe("0");
    fireEvent.focus(label!);
    expect(screen.getByRole("tooltip")).toBeTruthy();
  });

  it("opens the dialog from View all, and says when there is nothing to suggest", async () => {
    getSuggestedAccounts.mockResolvedValue([]);
    const onViewAll = vi.fn();
    render(<SuggestedAccountsPanel open excludeUserId="7" onViewAll={onViewAll} />);

    expect(await screen.findByText("No suggestions right now.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "View all" }));
    expect(onViewAll).toHaveBeenCalledTimes(1);
  });

  it("keeps its height and says so when the request fails", async () => {
    getSuggestedAccounts.mockRejectedValue(new Error("down"));
    render(<SuggestedAccountsPanel open excludeUserId="7" onViewAll={vi.fn()} />);
    expect(await screen.findByText("Couldn't load suggestions.")).toBeTruthy();
  });
});
