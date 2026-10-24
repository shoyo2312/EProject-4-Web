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

function renderViewer(groups: StoryGroup[], props: { onClose?: () => void; onSeen?: () => void } = {}) {
  return render(
    <StoryViewer
      groups={groups}
      authors={{ "2": author }}
      start={{ group: 0, story: 0 }}
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

    act(() => vi.advanceTimersByTime(5_050));
    act(() => vi.advanceTimersByTime(1_000));

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

    act(() => vi.advanceTimersByTime(6_000));
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
});
