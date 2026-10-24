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

// As notification-service writes it: SYSTEM, no actor, and the reference the web keys the link on.
const alert: NotificationResponse = {
  id: "n9",
  actorId: null,
  type: "SYSTEM",
  title: "Your account logged in from a new device",
  body:
    "Your account logged in from device Chrome on macOS 27 on 10/23 21:42 +07 in Ho Chi Minh City, " +
    "Vietnam. If this wasn't you, secure your account immediately.",
  referenceId: "account-security",
  read: false,
  createdAt: new Date().toISOString(),
};

function show(item: NotificationResponse) {
  const inbox: NotificationInbox = {
    items: [item],
    unreadCount: 1,
    loaded: true,
    actors: new Map(),
    videos: new Map(),
    markRead,
    markAllRead: vi.fn(),
  };
  render(<ActivityDrawer open inbox={inbox} onClose={onClose} />);
}

describe("ActivityDrawer, an account-security notice", () => {
  it("expands to the whole message and a link to Settings, which closes the drawer", () => {
    show(alert);
    expect(screen.queryByRole("link", { name: "Secure your account" })).toBeNull();

    fireEvent.click(screen.getByText("Your account logged in from a new device"));
    expect(markRead).toHaveBeenCalledWith("n9");
    expect(push).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("link", { name: "Secure your account" }));
    expect(push).toHaveBeenCalledWith("/setting");
    expect(onClose).toHaveBeenCalledOnce();
  });

  /** DB-IP's free licence asks web pages that show a looked-up place for a link back to DB-IP. */
  it("credits DB-IP under the place, without collapsing the notice", () => {
    show(alert);
    fireEvent.click(screen.getByText("Your account logged in from a new device"));

    const credit = screen.getByRole("link", { name: "IP Geolocation by DB-IP" });
    expect(credit.getAttribute("href")).toBe("https://db-ip.com");
    expect(credit.getAttribute("rel")).toBe("noopener noreferrer");

    credit.addEventListener("click", (event) => event.preventDefault()); // jsdom cannot navigate
    fireEvent.click(credit);

    expect(screen.queryByRole("link", { name: "Secure your account" })).not.toBeNull();
    expect(push).not.toHaveBeenCalled();
  });

  it("another system notice has no link", () => {
    show({ ...alert, id: "n10", title: "Welcome to Nowaa!", body: "Hi nora, thanks for joining us.", referenceId: null });

    fireEvent.click(screen.getByText("Welcome to Nowaa!"));

    expect(screen.queryByRole("link", { name: "Secure your account" })).toBeNull();
  });
});

describe("ActivityDrawer, a repost", () => {
  it("describes a repost", () => {
    const reposted: NotificationResponse = {
      id: "n11",
      actorId: "2",
      type: "REPOST",
      title: "New repost",
      body: "Someone reposted your video.",
      referenceId: "7",
      read: false,
      createdAt: new Date().toISOString(),
    };
    const inbox: NotificationInbox = {
      items: [reposted],
      unreadCount: 1,
      loaded: true,
      actors: new Map([["2", bob]]),
      videos: new Map(),
      markRead,
      markAllRead: vi.fn(),
    };
    render(<ActivityDrawer open inbox={inbox} onClose={onClose} />);

    expect(screen.getByText(/reposted your video/)).toBeTruthy();
  });
});

describe("ActivityDrawer, a weekly screen time update", () => {
  it("opens the Screen time summary on the week a weekly update covers", () => {
    show({
      id: "n12",
      actorId: null,
      type: "SCREEN_TIME",
      title: "Your weekly screen time",
      body: "Last week you spent 3h 20m on Nowaa, a daily average of 28m.",
      referenceId: "2026-10-19",
      read: false,
      createdAt: new Date().toISOString(),
    });

    fireEvent.click(screen.getByText(/Last week you spent 3h 20m/));

    expect(markRead).toHaveBeenCalledWith("n12");
    expect(push).toHaveBeenCalledWith("/setting?summary=2026-10-19#screen-time");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
