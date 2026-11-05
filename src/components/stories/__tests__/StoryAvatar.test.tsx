import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, createEvent, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StoryAvatar } from "@/components/stories/StoryAvatar";
import type { RingState } from "@/lib/stories/ring-store";
import type { Author } from "@/types/tiktok";

let ring: RingState = "unseen";
const openStories = vi.fn();
vi.mock("@/components/stories/StoriesProvider", () => ({
  useStoryRing: () => ring,
  useStories: () => ({ openStories, syncRings: () => {}, invalidateOwnRing: () => {} }),
}));

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const bob: Author = { userId: "2", username: "bob", nickname: "Bob", avatarUrl: "/bob.png" };

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  ring = "unseen";
});

describe("StoryAvatar", () => {
  it("renders the page's own avatar when there is no ring", () => {
    ring = "none";

    render(
      <StoryAvatar author={bob}>
        <a href="#profile">Profile of Bob</a>
      </StoryAvatar>,
    );

    expect(screen.getByRole("link", { name: "Profile of Bob" })).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("clicking the ring inside a link opens the stories and nothing else", async () => {
    openStories.mockResolvedValue(true);
    const link = vi.fn();
    render(
      <a href="#row" onClick={link}>
        <StoryAvatar author={bob} className="h-10 w-10">
          <span>avatar</span>
        </StoryAvatar>
      </a>,
    );
    const button = screen.getByRole("button", { name: "Watch Bob's stories" });
    const click = createEvent.click(button);

    fireEvent(button, click);

    expect(openStories).toHaveBeenCalledWith(bob);
    expect(link).not.toHaveBeenCalled();
    expect(click.defaultPrevented).toBe(true);
    expect(button.className).toContain("h-10");
    // The stories opened, so there is no profile to fall back to.
    await act(async () => {});
    expect(push).not.toHaveBeenCalled();
  });

  it("Enter on the ring does not reach the row", () => {
    const row = vi.fn();
    render(
      <div onKeyDown={row}>
        <StoryAvatar author={bob}>
          <span>avatar</span>
        </StoryAvatar>
      </div>,
    );
    const button = screen.getByRole("button", { name: "Watch Bob's stories" });

    fireEvent.keyDown(button, { key: "Enter" });
    fireEvent.keyDown(button, { key: " " });
    expect(row).not.toHaveBeenCalled();

    // Only the keys that activate a button are kept from the row; the others are not its business.
    fireEvent.keyDown(button, { key: "ArrowDown" });
    expect(row).toHaveBeenCalledTimes(1);
  });

  it("a ring whose stories are gone goes to the profile", async () => {
    openStories.mockResolvedValue(false);
    render(
      <StoryAvatar author={bob}>
        <span>avatar</span>
      </StoryAvatar>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Watch Bob's stories" }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/@bob"));
  });

  it("never spins a full-size list ring either: spinning is the tray's and the profile's", () => {
    render(
      <StoryAvatar author={bob} className="h-12 w-12">
        <span>avatar</span>
      </StoryAvatar>,
    );
    const button = screen.getByRole("button", { name: "Watch Bob's stories" });
    expect(button.querySelector("[data-ring='unseen']")).not.toBeNull();
    expect(button.innerHTML).not.toContain("tt-ring-spin");
  });

  it("never spins a thin ring", () => {
    render(
      <StoryAvatar author={bob} thin className="h-6 w-6">
        <span>avatar</span>
      </StoryAvatar>,
    );
    const button = screen.getByRole("button", { name: "Watch Bob's stories" });
    expect(button.querySelector("[data-ring='unseen']")).not.toBeNull();
    expect(button.innerHTML).not.toContain("tt-ring-spin");
  });
});
