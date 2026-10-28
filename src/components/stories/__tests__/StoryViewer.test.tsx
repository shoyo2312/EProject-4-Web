import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StoryViewer } from "@/components/stories/StoryViewer";
import { toast } from "@/components/ui/toast";
import { holdPlayback } from "@/lib/playback-hold";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";

const openLogin = vi.fn();
const session: { user: { userId: string } | null } = { user: { userId: "1" } };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: session.user, openLogin }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));

const recordStoryView = vi.fn();
const getStory = vi.fn();
const setStoryReaction = vi.fn<(id: string, reaction: string) => Promise<void>>(async () => undefined);
const clearStoryReaction = vi.fn<(id: string) => Promise<void>>(async () => undefined);
vi.mock("@/lib/api/stories", () => ({
  recordStoryView: (id: string) => recordStoryView(id),
  getStory: (id: string) => getStory(id),
  setStoryReaction: (id: string, reaction: string) => setStoryReaction(id, reaction),
  clearStoryReaction: (id: string) => clearStoryReaction(id),
  getStoryViewers: async () => [],
  updateStoryVisibility: async () => ({}),
  deleteStory: async () => undefined,
}));
vi.mock("@/lib/api/users", () => ({ getProfiles: async () => [] }));

function story(id: string, overrides: Partial<StoryResponse> = {}): StoryResponse {
  return {
    id,
    userId: "2",
    mediaUrl: `https://media/${id}.jpg`,
    mediaType: "IMAGE",
    caption: id,
    visibility: "PUBLIC",
    status: null,
    durationSeconds: null,
    viewCount: null,
    viewedByMe: false,
    myReaction: null,
    reactionCounts: null,
    createdAt: "2026-10-20T10:00:00Z",
    expiresAt: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

const theirs: StoryGroup[] = [{ userId: "2", hasUnseen: true, stories: [story("a"), story("b")] }];
const author = { userId: "2", username: "2", nickname: "Bob", avatarUrl: "/bob.png" };

function renderViewer(
  groups: StoryGroup[],
  props: { onClose?: () => void; onSeen?: () => void; closing?: boolean } = {},
) {
  return render(
    <StoryViewer
      groups={groups}
      authors={{ "2": author }}
      start={{ group: 0, story: 0 }}
      closing={props.closing}
      onClose={props.onClose ?? (() => {})}
      onSeen={props.onSeen ?? (() => {})}
      onOwnStoryChanged={() => {}}
      onOwnStoryDeleted={() => {}}
    />,
  );
}

function progressValues(): number[] {
  return Array.from(document.querySelectorAll("progress")).map((bar) => Number(bar.value));
}

beforeEach(() => {
  recordStoryView.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  recordStoryView.mockReset();
  getStory.mockReset();
  setStoryReaction.mockClear();
  clearStoryReaction.mockClear();
  session.user = { userId: "1" };
});

describe("StoryViewer", () => {
  it("counts someone else's story once and marks it seen", async () => {
    const onSeen = vi.fn();
    const { rerender } = renderViewer(theirs, { onSeen });

    await waitFor(() => expect(recordStoryView).toHaveBeenCalledWith("a"));
    expect(onSeen).toHaveBeenCalledWith("a");

    // The tray hands back a new object for the story it just marked; that is not a new story.
    const marked: StoryGroup[] = [{ ...theirs[0], stories: [story("a", { viewedByMe: true }), story("b")] }];
    rerender(
      <StoryViewer
        groups={marked}
        authors={{ "2": author }}
        start={{ group: 0, story: 0 }}
        onClose={() => {}}
        onSeen={onSeen}
        onOwnStoryChanged={() => {}}
        onOwnStoryDeleted={() => {}}
      />,
    );
    expect(recordStoryView).toHaveBeenCalledTimes(1);
  });

  it("does not count the owner's own view, and shows them where it stands", async () => {
    const own: StoryGroup[] = [
      { userId: "1", hasUnseen: false, stories: [story("mine", { userId: "1", status: "PENDING_MODERATION", viewCount: 0 })] },
    ];

    renderViewer(own);

    expect(await screen.findByText("Pending review")).toBeTruthy();
    expect(recordStoryView).not.toHaveBeenCalled();
  });

  it("plays the next story from its start, not from where the last one ended", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const onClose = vi.fn();
    renderViewer(theirs, { onClose });
    await act(async () => {});

    // An image story runs 30 s (navigation.ts IMAGE_MS); 6 s into the next one is 0.2.
    act(() => vi.advanceTimersByTime(30_050));
    act(() => vi.advanceTimersByTime(6_000));

    expect(onClose).not.toHaveBeenCalled();
    const [first, second] = progressValues();
    expect(first).toBe(1);
    expect(second).toBeGreaterThan(0.1);
    expect(second).toBeLessThan(0.3);
  });

  it("stands still while playback is held, and runs on once released", async () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const onClose = vi.fn();
    const release = holdPlayback();
    renderViewer(theirs, { onClose });
    await act(async () => {});

    try {
      act(() => vi.advanceTimersByTime(12_000));
      expect(progressValues()[0]).toBe(0);
    } finally {
      act(() => release());
    }

    act(() => vi.advanceTimersByTime(31_000));
    expect(progressValues()[0]).toBe(1);
  });

  it("asks once for a fresh media URL when the signed one fails, then gives up", async () => {
    getStory.mockResolvedValue(story("a", { mediaUrl: "https://media/a-fresh.jpg" }));
    renderViewer(theirs);

    fireEvent.error(await screen.findByAltText("a"));
    await waitFor(() =>
      expect(screen.getByAltText("a").getAttribute("src")).toBe("https://media/a-fresh.jpg"),
    );
    expect(getStory).toHaveBeenCalledWith("a");

    fireEvent.error(screen.getByAltText("a"));
    expect(await screen.findByText("This story can’t be shown right now.")).toBeTruthy();
    expect(getStory).toHaveBeenCalledTimes(1);
  });

  it("links the owner's name to their profile and closes the player on the way", async () => {
    const onClose = vi.fn();
    renderViewer(theirs, { onClose });
    await act(async () => {});

    const link = screen.getByRole("link", { name: "Bob" });
    expect(link.getAttribute("href")).toBe("/@2");
    fireEvent.click(link);
    expect(onClose).toHaveBeenCalled();
  });

  describe("pausing", () => {
    const clocked = async () => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance", "setTimeout", "clearTimeout"] });
      renderViewer(theirs);
      await act(async () => {});
      return document.querySelector("[data-story-media]") as HTMLElement;
    };

    it("holds the clock while the pointer is held past 200ms and resumes on release", async () => {
      const media = await clocked();
      act(() => vi.advanceTimersByTime(3_000));
      const before = progressValues()[0];

      fireEvent.pointerDown(media);
      act(() => vi.advanceTimersByTime(250));
      act(() => vi.advanceTimersByTime(3_000));
      const held = progressValues()[0];
      expect(held - before).toBeLessThan(0.02);

      fireEvent.pointerUp(media);
      act(() => vi.advanceTimersByTime(3_000));
      expect(progressValues()[0]).toBeGreaterThan(held + 0.05);
    });

    it("still steps forward on a press shorter than 200ms", async () => {
      const media = await clocked();
      fireEvent.pointerDown(media);
      act(() => vi.advanceTimersByTime(100));
      fireEvent.pointerUp(media);
      fireEvent.click(screen.getByRole("button", { name: "Next story" }));

      expect(progressValues()[0]).toBe(1);
    });

    it("does not step on the click that ends a hold", async () => {
      const media = await clocked();
      fireEvent.pointerDown(media);
      act(() => vi.advanceTimersByTime(250));
      fireEvent.pointerUp(media);
      fireEvent.click(screen.getByRole("button", { name: "Next story" }));

      expect(progressValues()[0]).toBeLessThan(1);
    });

    it("resumes when the pointer leaves the card mid-hold", async () => {
      const media = await clocked();
      fireEvent.pointerDown(media);
      act(() => vi.advanceTimersByTime(250));
      fireEvent.pointerLeave(media);
      const released = progressValues()[0];
      act(() => vi.advanceTimersByTime(3_000));

      expect(progressValues()[0]).toBeGreaterThan(released + 0.05);
    });

    it("toggles a sticky pause with the button and with Space", async () => {
      await clocked();
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      expect(screen.getByRole("button", { name: "Play" }).getAttribute("aria-pressed")).toBe("true");
      expect(document.querySelector("[data-paused-glyph]")).not.toBeNull();
      const paused = progressValues()[0];
      act(() => vi.advanceTimersByTime(3_000));
      expect(progressValues()[0] - paused).toBeLessThan(0.02);

      fireEvent.keyDown(document, { key: " " });
      expect(document.querySelector("[data-paused-glyph]")).toBeNull();
      act(() => vi.advanceTimersByTime(3_000));
      expect(progressValues()[0]).toBeGreaterThan(paused + 0.05);
    });

    it("keeps a sticky pause when the pointer merely leaves the media after an earlier hold", async () => {
      const media = await clocked();
      fireEvent.pointerDown(media);
      act(() => vi.advanceTimersByTime(250));
      fireEvent.pointerUp(media);

      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      fireEvent.pointerLeave(media);

      expect(screen.getByRole("button", { name: "Play" }).getAttribute("aria-pressed")).toBe("true");
    });

    it("clears the sticky pause when stepping to the next story", async () => {
      await clocked();
      fireEvent.click(screen.getByRole("button", { name: "Pause" }));
      fireEvent.click(screen.getByRole("button", { name: "Next story" }));

      expect(document.querySelector("[data-paused-glyph]")).toBeNull();
      act(() => vi.advanceTimersByTime(3_000));
      expect(progressValues()[1]).toBeGreaterThan(0.05);
    });
  });

  describe("backdrop", () => {
    it("blurs the image behind itself", async () => {
      renderViewer(theirs);
      const backdrop = document.querySelector("img[data-backdrop]");

      expect(backdrop?.getAttribute("src")).toBe("https://media/a.jpg");
      expect(backdrop?.getAttribute("aria-hidden")).toBe("true");
    });

    it("draws a gradient, not a second video, behind a video", () => {
      vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
      vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
      const clip: StoryGroup[] = [{ userId: "2", hasUnseen: true, stories: [story("v", { mediaType: "VIDEO", durationSeconds: 5 })] }];
      renderViewer(clip);

      const backdrop = document.querySelector("[data-backdrop]");
      expect(backdrop).not.toBeNull();
      expect(backdrop?.tagName).not.toBe("IMG");
      expect(document.querySelectorAll("video")).toHaveLength(1);
    });

    it("draws no backdrop image once the media is unavailable", async () => {
      getStory.mockRejectedValue(new Error("gone"));
      renderViewer(theirs);

      fireEvent.error(await screen.findByAltText("a"));
      expect(await screen.findByText("This story can’t be shown right now.")).toBeTruthy();
      expect(document.querySelector("[data-backdrop]")).toBeNull();
    });
  });

  describe("layout", () => {
    it("moves only under motion-safe, and keeps the header clear of the Close button on phones", async () => {
      renderViewer(theirs);
      await act(async () => {});
      const card = document.querySelector("[data-story-card]") as HTMLElement;

      expect(card.className).toContain("motion-safe:starting:scale-[0.92]");
      expect(card.className).not.toMatch(/(^|\s)starting:scale/);
      expect(card.className).not.toMatch(/(^|\s)transition-\[transform/);
      expect(screen.getByRole("button", { name: "Pause" }).closest("[data-story-header]")?.className).toContain("pr-12");
    });
  });

  describe("closing", () => {
    it("is inert and shrinking while closing, and the clock stops", async () => {
      vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
      renderViewer(theirs, { closing: true });
      await act(async () => {});

      const dialog = screen.getByRole("dialog", { hidden: true });
      expect(dialog.hasAttribute("inert")).toBe(true);
      expect(dialog.querySelector("[data-story-card]")?.className).toContain("scale-[0.92]");
      act(() => vi.advanceTimersByTime(3_000));
      expect(progressValues()[0]).toBe(0);
    });
  });

  describe("reactions", () => {
    it("sends the reaction after showing it, and reverts when the request fails", async () => {
      setStoryReaction.mockRejectedValueOnce(new Error("down"));
      renderViewer(theirs);

      fireEvent.click(screen.getByRole("button", { name: "Love" }));
      expect(screen.getByRole("button", { name: "Love" }).getAttribute("aria-pressed")).toBe("true");

      await waitFor(() => expect(setStoryReaction).toHaveBeenCalledWith("a", "LOVE"));
      await waitFor(() => expect(screen.getByRole("button", { name: "Love" }).getAttribute("aria-pressed")).toBe("false"));
      expect(toast.error).toHaveBeenCalledWith("Couldn't send your reaction");
    });

    it("clears a reaction through the API", async () => {
      renderViewer([{ ...theirs[0], stories: [story("a", { myReaction: "WOW" }), story("b")] }]);

      fireEvent.click(screen.getByRole("button", { name: "Wow" }));

      await waitFor(() => expect(clearStoryReaction).toHaveBeenCalledWith("a"));
    });

    it("sends only the reaction the viewer settles on", async () => {
      vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
      renderViewer(theirs);

      fireEvent.click(screen.getByRole("button", { name: "Love" }));
      fireEvent.click(screen.getByRole("button", { name: "Love" }));
      act(() => vi.advanceTimersByTime(600));
      expect(setStoryReaction).not.toHaveBeenCalled();
      expect(clearStoryReaction).not.toHaveBeenCalled();

      fireEvent.click(screen.getByRole("button", { name: "Wow" }));
      fireEvent.click(screen.getByRole("button", { name: "Sad" }));
      act(() => vi.advanceTimersByTime(600));
      expect(setStoryReaction).toHaveBeenCalledTimes(1);
      expect(setStoryReaction).toHaveBeenCalledWith("a", "SAD");
    });

    it("leaves the sides of the bar free for stepping", () => {
      renderViewer(theirs);
      const bar = screen.getByRole("button", { name: "Love" }).closest("[data-reaction-bar]") as HTMLElement;

      expect(bar.parentElement?.className).toContain("pointer-events-none");
      expect(bar.className).toContain("pointer-events-auto");
    });

    it("pauses the story while a guest is sent to sign in", () => {
      session.user = null;
      renderViewer(theirs);

      fireEvent.click(screen.getByRole("button", { name: "Love" }));

      expect(openLogin).toHaveBeenCalledOnce();
      expect(document.querySelector("[data-paused-glyph]")).not.toBeNull();
      expect(setStoryReaction).not.toHaveBeenCalled();
    });

    it("gives the owner a ⋯ menu beside mute, and nobody else", async () => {
      renderViewer([{ userId: "1", hasUnseen: false, stories: [story("mine", { userId: "1", status: "ACTIVE", viewCount: 0 })] }]);
      expect(screen.getByRole("button", { name: "More" }).closest("[data-story-header]")).not.toBeNull();
      cleanup();

      renderViewer(theirs);
      expect(screen.queryByRole("button", { name: "More" })).toBeNull();
    });

    it("a tap that closes the owner's ⋯ menu does not also step the story", () => {
      const onClose = vi.fn();
      renderViewer(
        [{ userId: "1", hasUnseen: false, stories: [story("mine", { userId: "1", status: "ACTIVE", viewCount: 0 })] }],
        { onClose },
      );
      fireEvent.click(screen.getByRole("button", { name: "More" }));
      expect(screen.getByRole("menu")).toBeTruthy();

      const media = document.querySelector("[data-story-media]") as HTMLElement;
      const next = screen.getByRole("button", { name: "Next story" });
      fireEvent.pointerDown(next);
      fireEvent.pointerUp(next);
      fireEvent.click(next);

      expect(onClose).not.toHaveBeenCalled();
      expect(media).toBeTruthy();

      // With the menu gone, the next tap steps as usual.
      fireEvent.pointerDown(next);
      fireEvent.pointerUp(next);
      fireEvent.click(next);
      expect(onClose).toHaveBeenCalledOnce();
    });

    it("shows no reaction bar under your own story", () => {
      renderViewer([{ userId: "1", hasUnseen: false, stories: [story("mine", { userId: "1", status: "ACTIVE", viewCount: 0 })] }]);

      expect(screen.queryByRole("button", { name: "Love" })).toBeNull();
    });
  });
});
