import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { SideNav } from "@/components/layout/SideNav";
import type { UserProfileResponse } from "@/lib/api/types";
import { NAV_ITEMS } from "@/lib/site-config";

let pathname = "/";
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({
    user: { userId: "1", username: "me", avatarUrl: "/me.png" },
    isLoading: false,
    openLogin: () => {},
  }),
}));
vi.mock("@/hooks/use-notifications", () => ({ useNotifications: () => ({ unreadCount: 0 }) }));
vi.mock("@/hooks/use-following-accounts", () => ({
  useFollowingAccounts: () => ({ accounts: [bob] }),
}));

// The drawers have tests of their own; here only whether the rail holds each one open matters.
vi.mock("@/components/layout/ActivityDrawer", () => ({
  ActivityDrawer: ({ open }: { open: boolean }) => <div data-testid="activity" data-open={open} />,
}));
vi.mock("@/components/layout/SearchDrawer", () => ({
  SearchDrawer: ({ open }: { open: boolean }) => <div data-testid="search" data-open={open} />,
}));
vi.mock("@/components/layout/MoreDrawer", () => ({
  MoreDrawer: ({ open }: { open: boolean }) => <div data-testid="more" data-open={open} />,
}));
vi.mock("@/components/layout/FollowingDrawer", () => ({
  FollowingDrawer: ({ open }: { open: boolean }) => <div data-testid="following" data-open={open} />,
}));

const bob: UserProfileResponse = {
  userId: "2",
  username: "bob",
  displayName: "Bob",
  bio: null,
  avatarUrl: "/bob.png",
  followerCount: 0,
  followingCount: 0,
};

const nav = () => <SideNav navItems={NAV_ITEMS} footerSections={[]} />;

beforeEach(() => {
  pathname = "/";
  // jsdom has no matchMedia, and the rail reads one to know when it is below its breakpoint.
  Object.defineProperty(window, "matchMedia", {
    configurable: true,
    writable: true,
    value: () => ({ matches: false, addEventListener: () => {}, removeEventListener: () => {} }),
  });
});

afterEach(() => {
  cleanup();
});

describe("SideNav", () => {
  it.each([
    ["Activity", () => screen.getByRole("button", { name: "Activity" })],
    ["Search", () => screen.getByRole("button", { name: "Search" })],
    ["More", () => screen.getByRole("button", { name: "More" })],
    ["Following", () => screen.getByRole("button", { name: "View all" })],
  ])("closes the %s drawer when the page changes", (name, opener) => {
    const testId = name.toLowerCase();
    const { rerender } = render(nav());
    fireEvent.click(opener());
    expect(screen.getByTestId(testId).dataset.open).toBe("true");

    // A ring that led nowhere pushes the profile; the click that did it never reached the drawer's own close.
    pathname = "/@bob";
    rerender(nav());

    expect(screen.getByTestId(testId).dataset.open).toBe("false");
  });
});
