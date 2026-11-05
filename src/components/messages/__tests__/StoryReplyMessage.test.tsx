import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { StoryReplyMessage } from "@/components/messages/thread/StoryReplyMessage";
import type { StoryCard } from "@/lib/api/conversations";

const { openStories, toastError } = vi.hoisted(() => ({ openStories: vi.fn(), toastError: vi.fn() }));
vi.mock("@/components/stories/StoriesProvider", () => ({ useStories: () => ({ openStories }) }));
vi.mock("@/components/messages/ChatUnreadProvider", () => ({ useChatUnreadContext: () => ({ authors: new Map() }) }));
vi.mock("@/components/ui/toast", () => ({ toast: { error: toastError } }));

afterEach(() => {
  cleanup();
  openStories.mockReset();
});

const available: StoryCard = { storyId: "s1", state: "AVAILABLE", ownerId: "7", mediaType: "IMAGE", mediaUrl: "https://signed/s1" };

describe("StoryReplyMessage", () => {
  it("labels each side, shows the card and keeps the reply text in its bubble", () => {
    const { rerender } = render(<StoryReplyMessage story={available} mine text="iu em" bubbleClassName="b" />);
    expect(screen.getByText("You replied to their story")).toBeTruthy();
    expect(screen.getByText("iu em").className).toBe("b");
    expect(screen.getByRole("button", { name: "Open story" })).toBeTruthy();
    rerender(<StoryReplyMessage story={available} mine={false} text="iu em" bubbleClassName="b" />);
    expect(screen.getByText("Replied to your story")).toBeTruthy();
  });

  it("an unavailable story is a notice with no media, and the text stays", () => {
    render(
      <StoryReplyMessage
        story={{ storyId: "s1", state: "UNAVAILABLE", ownerId: null, mediaType: null, mediaUrl: null }}
        mine
        text="still here"
        bubbleClassName="b"
      />,
    );
    expect(screen.getByRole("img", { name: "Story unavailable" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Open story" })).toBeNull();
    expect(document.querySelector("img[src], video[src]")).toBeNull();
    expect(screen.getByText("still here")).toBeTruthy();
  });

  it("an outage says so instead of claiming the story is gone", () => {
    render(
      <StoryReplyMessage
        story={{ storyId: "s1", state: "UNKNOWN", ownerId: null, mediaType: null, mediaUrl: null }}
        mine={false}
        text="x"
        bubbleClassName="b"
      />,
    );
    expect(screen.getByRole("img", { name: "Story couldn't be loaded" })).toBeTruthy();
  });

  it("a video story is a muted first frame that never autoplays", () => {
    render(
      <StoryReplyMessage story={{ ...available, mediaType: "VIDEO" }} mine text="x" bubbleClassName="b" />,
    );
    const video = document.querySelector("video") as HTMLVideoElement;
    expect(video.autoplay).toBe(false);
    expect(video.muted).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
  });

  it("opens the owner's stories, and says so when they cannot be opened", async () => {
    openStories.mockResolvedValue(false);
    render(<StoryReplyMessage story={available} mine text="x" bubbleClassName="b" />);
    fireEvent.click(screen.getByRole("button", { name: "Open story" }));
    expect(openStories).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toastError).toHaveBeenCalledWith("This story isn't available anymore"));
  });
});
