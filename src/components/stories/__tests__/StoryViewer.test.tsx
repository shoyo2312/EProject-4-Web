import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StoryViewer } from "@/components/stories/StoryViewer";
import { holdPlayback } from "@/lib/playback-hold";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" } }),
}));

const recordStoryView = vi.fn();
const getStory = vi.fn();
vi.mock("@/lib/api/stories", () => ({
  recordStoryView: (id: string) => recordStoryView(id),
  getStory: (id: string) => getStory(id),
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
});
