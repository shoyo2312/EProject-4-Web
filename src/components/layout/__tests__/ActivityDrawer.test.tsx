import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ActivityDrawer } from "@/components/layout/ActivityDrawer";
import type { NotificationInbox } from "@/hooks/use-notifications";
import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import type { NotificationResponse } from "@/lib/api/notifications";
import type { UserProfileResponse } from "@/lib/api/types";
import type { RingState } from "@/lib/stories/ring-store";

let ring: RingState = "none";
const openStories = vi.fn();
vi.mock("@/components/stories/StoriesProvider", () => ({
  useStoryRing: () => ring,
  useStories: () => ({ openStories, syncRings: () => {}, invalidateOwnRing: () => {} }),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));
vi.mock("@/lib/api/users", () => ({
  getFollowRequests: async () => ({ page: { totalElements: 0 } }),
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

// As notification-service writes it: the owner is both actor and reference, not a story id.
const posted: NotificationResponse = {
  id: "n1",
  actorId: "2",
  type: "STORY",
  title: "New story",
  body: "Someone posted a new story.",
  referenceId: "2",
  read: false,
  createdAt: new Date().toISOString(),
};

const markRead = vi.fn();
const onClose = vi.fn();

/** Draws the drawer with the one story entry. */
function showStoryEntry(actors: [string, UserProfileResponse][] = []) {
  const inbox: NotificationInbox = {
    items: [posted],
    unreadCount: 1,
    loaded: true,
    actors: new Map(actors),
    videos: new Map(),
    markRead,
    markAllRead: vi.fn(),
  };
  render(<ActivityDrawer open inbox={inbox} onClose={onClose} />);
}

/** Draws the drawer with the one story entry, and taps it. */
function tapStoryEntry(actors: [string, UserProfileResponse][] = []) {
  showStoryEntry(actors);
  fireEvent.click(screen.getByText(/posted a new story/));
}

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  ring = "none";
});

describe("ActivityDrawer, a story entry", () => {
  it("opens the owner's stories as the profile it has, and closes the drawer", async () => {
    openStories.mockResolvedValue(true);

    tapStoryEntry([["2", bob]]);

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(openStories).toHaveBeenCalledWith(authorFromProfile(bob));
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(push).not.toHaveBeenCalled();
  });

  it("asks by id while the owner's profile is still resolving", async () => {
    openStories.mockResolvedValue(true);

    tapStoryEntry();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(openStories).toHaveBeenCalledWith(unknownAuthor("2"));
  });

  it("goes to the owner's profile when none of their stories can be watched any more", async () => {
    openStories.mockResolvedValue(false);

    tapStoryEntry([["2", bob]]);

    await waitFor(() => expect(push).toHaveBeenCalledWith("/@2"));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("leaves a tap on the owner's ringed avatar to the entry: stories open, it is read, the drawer closes", async () => {
    ring = "unseen";
    openStories.mockResolvedValue(true);
    showStoryEntry([["2", bob]]);

    // The ring is still drawn around the picture; it just is not a button of its own.
    const drawn = document.querySelector("img")?.closest("[class*='tt-red']");
    expect(drawn).not.toBeNull();
    fireEvent.click(drawn!);

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce());
    expect(markRead).toHaveBeenCalledWith("n1");
    expect(openStories).toHaveBeenCalledOnce();
    expect(openStories).toHaveBeenCalledWith(authorFromProfile(bob));
    expect(push).not.toHaveBeenCalled();
  });
});
