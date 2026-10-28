import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { StoryBar, StoryTray } from "@/components/stories/StoryTray";
import { toast } from "@/components/ui/toast";
import type { StoryGroup, StoryResponse, StoryStatus } from "@/lib/api/types";

vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1", avatarUrl: "/me.png" } }),
}));

const invalidateOwnRing = vi.fn();
vi.mock("@/components/stories/StoriesProvider", () => ({
  useStories: () => ({ openStories: async () => false, syncRings: () => {}, invalidateOwnRing }),
}));

// What the feed hook hands the bar; each test sets the groups before it renders.
const feed = { groups: [] as StoryGroup[], profiles: {}, refresh: () => {}, markSeen: () => {} };
vi.mock("@/hooks/use-story-feed", () => ({ useStoryFeed: () => feed }));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), warning: vi.fn() } }));

/** The viewer's own group, holding one story at the given stage of its review. */
function mine(status: StoryStatus, id = "mine"): StoryGroup {
  const story: StoryResponse = {
    id,
    userId: "1",
    mediaUrl: "https://media/mine.jpg",
    mediaType: "IMAGE",
    caption: null,
    visibility: "PUBLIC",
    status,
    durationSeconds: null,
    viewCount: 0,
    viewedByMe: false,
    createdAt: "2026-10-20T10:00:00Z",
    expiresAt: "2026-10-21T10:00:00Z",
  };
  return { userId: "1", hasUnseen: false, stories: [story] };
}

/** The viewer's own group holding several stories. */
const mineAll = (...groups: StoryGroup[]): StoryGroup => ({
  userId: "1",
  hasUnseen: false,
  stories: groups.flatMap((group) => group.stories),
});

/** The state of the ring a tray bubble draws. */
const ringOf = (bubble: HTMLElement) => bubble.firstElementChild?.getAttribute("data-ring");

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  feed.groups = [];
});

describe("StoryTray's own bubble", () => {
  const tray = (groups: StoryGroup[]) =>
    render(<StoryTray groups={groups} authors={{}} onOpen={() => {}} onCreate={() => {}} />);

  it("is red while a story of yours is live", () => {
    tray([mine("ACTIVE")]);

    expect(ringOf(screen.getByRole("button", { name: "Your story" }))).toBe("unseen");
  });

  it.each<StoryStatus>(["PENDING_MODERATION", "HELD", "REJECTED"])(
    "is grey while the only story you have is %s",
    (status) => {
      tray([mine(status)]);

      expect(ringOf(screen.getByRole("button", { name: "Your story" }))).toBe("seen");
    },
  );

  it("spins the ring of a bubble with unseen stories, not one already seen", () => {
    const theirs = (hasUnseen: boolean): StoryGroup => ({ userId: "2", hasUnseen, stories: [] });
    render(<StoryTray groups={[theirs(true)]} authors={{}} onOpen={() => {}} onCreate={() => {}} />);
    expect(screen.getByRole("button", { name: /story, new/ }).innerHTML).toContain("tt-ring-spin");
    cleanup();

    render(<StoryTray groups={[theirs(false)]} authors={{}} onOpen={() => {}} onCreate={() => {}} />);
    expect(screen.getByRole("button", { name: /'s story$/ }).innerHTML).not.toContain("tt-ring-spin");
  });

  it("shows a pending ring on your bubble while your only story is in review", () => {
    tray([mine("PENDING_MODERATION")]);
    const own = screen.getByRole("button", { name: "Your story" });
    expect(own.querySelector("[data-pending]")).not.toBeNull();
    cleanup();

    tray([mine("ACTIVE")]);
    expect(screen.getByRole("button", { name: "Your story" }).querySelector("[data-pending]")).toBeNull();
  });

  it("has no ring before you have posted anything", () => {
    tray([]);

    const [bubble] = screen.getAllByRole("button", { name: "Create a story" });
    expect(ringOf(bubble)).toBe("none");
  });
});

describe("StoryBar", () => {
  const bar = () => <StoryBar followedIds={["2"]} />;

  it("asks again about the viewer's own ring once their pending story has its verdict, and only then", () => {
    feed.groups = [mine("PENDING_MODERATION")];
    const { rerender } = render(bar());
    // Pending on first render is not a verdict.
    expect(invalidateOwnRing).not.toHaveBeenCalled();

    rerender(bar());
    expect(invalidateOwnRing).not.toHaveBeenCalled();

    feed.groups = [mine("ACTIVE")];
    rerender(bar());
    expect(invalidateOwnRing).toHaveBeenCalledTimes(1);

    rerender(bar());
    expect(invalidateOwnRing).toHaveBeenCalledTimes(1);
  });

  it("does not ask when nothing was ever pending", () => {
    feed.groups = [mine("ACTIVE")];
    const { rerender } = render(bar());
    expect(invalidateOwnRing).not.toHaveBeenCalled();

    feed.groups = [];
    rerender(bar());
    expect(invalidateOwnRing).not.toHaveBeenCalled();
  });
});

describe("StoryBar's verdict toasts", () => {
  const bar = () => <StoryBar followedIds={["2"]} />;

  it("toasts once when a pending story of yours goes live", () => {
    feed.groups = [mine("PENDING_MODERATION")];
    const { rerender } = render(bar());
    expect(toast.success).not.toHaveBeenCalled();

    feed.groups = [mine("ACTIVE")];
    rerender(bar());
    expect(toast.success).toHaveBeenCalledWith("Your story is live");

    rerender(bar());
    expect(toast.success).toHaveBeenCalledTimes(1);
  });

  it("toasts for the story that went live while another is still pending, then for that one", () => {
    feed.groups = [mineAll(mine("PENDING_MODERATION", "a"), mine("PENDING_MODERATION", "b"))];
    const { rerender } = render(bar());

    feed.groups = [mineAll(mine("ACTIVE", "a"), mine("PENDING_MODERATION", "b"))];
    rerender(bar());
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).not.toHaveBeenCalled();

    feed.groups = [mineAll(mine("ACTIVE", "a"), mine("HELD", "b"))];
    rerender(bar());
    expect(toast.success).toHaveBeenCalledTimes(1);
    expect(toast.warning).toHaveBeenCalledTimes(1);
  });

  it("toasts a warning with a 'See why' action when it is held", () => {
    feed.groups = [mine("PENDING_MODERATION")];
    const { rerender } = render(bar());

    feed.groups = [mine("HELD")];
    rerender(bar());
    expect(toast.warning).toHaveBeenCalledWith(
      "Your story couldn't be shown",
      expect.objectContaining({ action: expect.objectContaining({ label: "See why" }) }),
    );
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("stays quiet when nothing of yours was pending", () => {
    feed.groups = [mine("ACTIVE")];
    const { rerender } = render(bar());
    feed.groups = [];
    rerender(bar());
    expect(toast.success).not.toHaveBeenCalled();
    expect(toast.warning).not.toHaveBeenCalled();
  });

describe("StoryBar's own bubble", () => {
  const bar = () => <StoryBar followedIds={["2"]} />;

  it("pops after a pending story goes live, then settles", () => {
    vi.useFakeTimers();
    feed.groups = [mine("PENDING_MODERATION")];
    const { rerender } = render(bar());
    feed.groups = [mine("ACTIVE")];
    rerender(bar());

    expect(screen.getByRole("button", { name: "Your story" }).querySelector("[data-pop]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByRole("button", { name: "Your story" }).querySelector("[data-pop]")).toBeNull();
    vi.useRealTimers();
  });
});

describe("StoryBar's player", () => {
  it("keeps the player mounted for 200ms after it closes", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    feed.groups = [{ userId: "2", hasUnseen: true, stories: [{ ...mine("ACTIVE").stories[0], id: "t", userId: "2" }] }];
    render(<StoryBar followedIds={["2"]} />);

    fireEvent.click(screen.getByRole("button", { name: /story, new/ }));
    expect(screen.getByRole("dialog")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("dialog", { hidden: true })).toBeTruthy();

    act(() => vi.advanceTimersByTime(200));
    expect(screen.queryByRole("dialog", { hidden: true })).toBeNull();
    vi.useRealTimers();
  });
});
});
