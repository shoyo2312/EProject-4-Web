import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfileStoryAvatar } from "@/components/stories/ProfileStoryAvatar";
import type { StoryResponse } from "@/lib/api/types";
import type { Author } from "@/types/tiktok";

let viewerId: string | null = "1";
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: viewerId ? { userId: viewerId } : null }),
}));

let stories: StoryResponse[] = [];
vi.mock("@/lib/api/stories", () => ({
  getUserStories: () => Promise.resolve(stories),
}));

vi.mock("@/components/stories/StoryViewer", () => ({
  StoryViewer: () => <div data-testid="story-viewer" />,
  VIEWER_EXIT_MS: 200,
}));

const bob: Author = { userId: "2", username: "bob", nickname: "Bob", avatarUrl: "/bob.png" };
const story = {
  id: "s1",
  userId: "2",
  status: "ACTIVE",
  visibility: "PUBLIC",
  mediaType: "IMAGE",
  myReaction: null,
  reactionCounts: null,
  mediaUrl: "/s1.jpg",
  seen: false,
  createdAt: "2026-10-28T00:00:00Z",
  expiresAt: "2026-10-29T00:00:00Z",
} as unknown as StoryResponse;

afterEach(() => {
  cleanup();
  viewerId = "1";
  stories = [];
});

describe("ProfileStoryAvatar", () => {
  it("clicking someone else's avatar offers to view it, and nothing else without stories", async () => {
    render(<ProfileStoryAvatar author={bob} />);
    await act(async () => {});

    fireEvent.click(screen.getByRole("button", { name: "Bob's avatar" }));

    expect(screen.getByRole("menuitem", { name: "View avatar" })).toBeTruthy();
    expect(screen.queryByRole("menuitem", { name: "View story" })).toBeNull();

    fireEvent.click(screen.getByRole("menuitem", { name: "View avatar" }));
    expect(screen.getByRole("dialog", { name: "Bob's avatar" })).toBeTruthy();
    expect(screen.queryByRole("menu")).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole("menu")).toBeNull());
  });

  it("offers the stories when there are some, and plays them", async () => {
    stories = [story];
    render(<ProfileStoryAvatar author={bob} />);
    await waitFor(() => expect(screen.getByRole("button", { name: "Bob's avatar" })).toBeTruthy());

    fireEvent.click(screen.getByRole("button", { name: "Bob's avatar" }));
    fireEvent.click(await screen.findByRole("menuitem", { name: "View story" }));

    expect(screen.getByTestId("story-viewer")).toBeTruthy();
  });

  it("the owner's own avatar plays the stories straight away", async () => {
    viewerId = "2";
    stories = [story];
    render(<ProfileStoryAvatar author={bob} />);

    fireEvent.click(await screen.findByRole("button", { name: "Watch Bob's stories" }));

    expect(screen.queryByRole("menu")).toBeNull();
    expect(screen.getByTestId("story-viewer")).toBeTruthy();
  });
});
