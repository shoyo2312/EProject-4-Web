import { useState } from "react";
import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { ProfileStoryAvatar } from "@/components/stories/ProfileStoryAvatar";
import { StoriesProvider, useStories, useStoryRing } from "@/components/stories/StoriesProvider";
import type { StoryResponse } from "@/lib/api/types";
import { RING_TTL_MS } from "@/lib/stories/ring-store";
import type { Author } from "@/types/tiktok";

const session: { user: { userId: string } | null; loading: boolean } = { user: { userId: "1" }, loading: false };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: session.user, isLoading: session.loading }),
}));

const getStoryRings = vi.fn();
const getUserStories = vi.fn();
const deleteStory = vi.fn();
vi.mock("@/lib/api/stories", () => ({
  getStoryRings: (userIds: string[]) => getStoryRings(userIds),
  getUserStories: (userId: string) => getUserStories(userId),
  deleteStory: (storyId: string) => deleteStory(storyId),
  recordStoryView: async () => undefined,
  getStory: async () => {
    throw new Error("a story whose link failed is not part of these tests");
  },
  getStoryViewers: async () => [],
  updateStoryVisibility: async () => ({}),
}));
vi.mock("@/lib/api/users", () => ({ getProfiles: async () => [] }));

const bob: Author = { userId: "2", username: "2", nickname: "Bob", avatarUrl: "/bob.png" };
const me: Author = { userId: "1", username: "me", nickname: "Me", avatarUrl: "/me.png" };

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

/** An avatar's view of the store: what its ring would be. */
function Ring({ id }: { id: string }) {
  const state = useStoryRing(id);
  return <p data-testid={`ring-${id}`}>{state}</p>;
}

/** A click on an avatar: open the stories, and show what the provider answered. */
function Open({ author }: { author: Author }) {
  const { openStories } = useStories();
  const [answer, setAnswer] = useState("not asked");
  return (
    <>
      <button type="button" onClick={() => void openStories(author).then((opened) => setAnswer(String(opened)))}>
        open {author.nickname}
      </button>
      <output>{answer}</output>
    </>
  );
}

const ring = (id: string) => screen.getByTestId(`ring-${id}`).textContent;
/** The classes of the ring a `StoryRing` button draws: its colour is the state. */
const ringClasses = (button: HTMLElement) => button.firstElementChild?.className ?? "";

/** The tab going to the background or coming back, as the browser reports it. */
function setPageHidden(hidden: boolean) {
  Object.defineProperty(document, "hidden", { configurable: true, get: () => hidden });
  document.dispatchEvent(new Event("visibilitychange"));
}

beforeEach(() => {
  session.user = { userId: "1" };
  session.loading = false;
  getStoryRings.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.resetAllMocks();
  Reflect.deleteProperty(document, "hidden");
});

describe("StoriesProvider", () => {
  it("a new viewer never sees the previous viewer's rings", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    const page = () => (
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>
    );
    const { rerender } = render(page());
    await waitFor(() => expect(ring("2")).toBe("unseen"));
    expect(getStoryRings).toHaveBeenCalledWith(["2"]);

    // Signed out, and the second answer is still on its way.
    session.user = null;
    getStoryRings.mockReturnValueOnce(new Promise(() => {}));
    rerender(page());

    expect(ring("2")).toBe("none");
    await waitFor(() => expect(getStoryRings).toHaveBeenCalledTimes(2));
    expect(ring("2")).toBe("none");
  });

  it("asks nothing while the session is still loading, then asks as the viewer it turns out to be", async () => {
    vi.useFakeTimers();
    session.user = null;
    session.loading = true;
    const page = () => (
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>
    );
    const { rerender } = render(page());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(getStoryRings).not.toHaveBeenCalled();
    expect(ring("2")).toBe("none");

    session.user = { userId: "1" };
    session.loading = false;
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    rerender(page());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(getStoryRings).toHaveBeenCalledTimes(1);
    expect(ring("2")).toBe("unseen");
  });

  it("asks as a guest once the session has resolved to nobody", async () => {
    vi.useFakeTimers();
    session.user = null;
    session.loading = true;
    const page = () => (
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>
    );
    const { rerender } = render(page());

    // No tokens to read, so the session settles without a viewer: the viewer id never changes.
    session.loading = false;
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    rerender(page());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(getStoryRings).toHaveBeenCalledTimes(1);
    expect(ring("2")).toBe("unseen");
  });

  it("asks again about an avatar that stays on screen once its answer is stale", async () => {
    vi.useFakeTimers();
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    render(
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(ring("2")).toBe("unseen");

    // Their story expired meanwhile, and nothing remounted the avatar to make it ask. The first
    // tick finds the answer a few milliseconds short of stale; the second one asks.
    getStoryRings.mockResolvedValueOnce([]);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2 * RING_TTL_MS);
    });

    expect(getStoryRings).toHaveBeenCalledTimes(2);
    expect(ring("2")).toBe("none");
  });

  it("does not renew rings while the page is hidden, and does as soon as it is shown again", async () => {
    vi.useFakeTimers();
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    render(
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(getStoryRings).toHaveBeenCalledTimes(1);

    setPageHidden(true);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3 * RING_TTL_MS);
    });
    expect(getStoryRings).toHaveBeenCalledTimes(1);

    getStoryRings.mockResolvedValueOnce([]);
    setPageHidden(false);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(getStoryRings).toHaveBeenCalledTimes(2);
    expect(ring("2")).toBe("none");
  });

  it("stops renewing rings when the viewer changes or the provider goes away", async () => {
    vi.useFakeTimers();
    const page = () => (
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>
    );
    const { rerender, unmount } = render(page());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(vi.getTimerCount()).toBe(1);

    // The new viewer's store has a timer of its own; the last one's is gone, not left running beside it.
    session.user = null;
    rerender(page());
    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });
    expect(vi.getTimerCount()).toBe(1);

    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("a player closed after the session ended never writes into the next viewer's store", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    getUserStories.mockResolvedValue([story("a")]);
    const page = () => (
      <StoriesProvider>
        <Ring id="2" />
        <ProfileStoryAvatar author={bob} />
      </StoriesProvider>
    );
    const { rerender } = render(page());
    await waitFor(() => expect(ring("2")).toBe("unseen"));
    fireEvent.click(await screen.findByRole("button", { name: "Watch Bob's stories" }));
    await screen.findByRole("dialog", { name: "Bob's story" });

    // The session ends in this tab. As a guest they cannot see the story (it was for friends), so the
    // header goes back to the bare picture and its player unmounts under the new viewer.
    session.user = null;
    getUserStories.mockResolvedValue([]);
    getStoryRings.mockResolvedValueOnce([]);
    await act(async () => {
      rerender(page());
    });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(ring("2")).toBe("none");
    // Nothing written into the guest's store, so it still asks about the owner itself.
    await waitFor(() => expect(getStoryRings).toHaveBeenCalledTimes(2));
    expect(ring("2")).toBe("none");
  });

  it(`openStories on a user whose getUserStories resolves [] resolves false, and that user's ring becomes "none"`, async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    getUserStories.mockResolvedValue([]);
    render(
      <StoriesProvider>
        <Ring id="2" />
        <Open author={bob} />
      </StoriesProvider>,
    );
    await waitFor(() => expect(ring("2")).toBe("unseen"));

    fireEvent.click(screen.getByRole("button", { name: "open Bob" }));

    expect(await screen.findByText("false")).toBeTruthy();
    expect(ring("2")).toBe("none");
    expect(getUserStories).toHaveBeenCalledWith("2");
    // The ring was set, not forgotten: nothing asks the server about it again.
    expect(getStoryRings).toHaveBeenCalledTimes(1);
  });

  it("openStories on a user whose getUserStories fails is the same", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    getUserStories.mockRejectedValue(new Error("down"));
    render(
      <StoriesProvider>
        <Ring id="2" />
        <Open author={bob} />
      </StoriesProvider>,
    );
    await waitFor(() => expect(ring("2")).toBe("unseen"));

    fireEvent.click(screen.getByRole("button", { name: "open Bob" }));

    expect(await screen.findByText("false")).toBeTruthy();
    expect(ring("2")).toBe("none");
  });

  it("opens the player on their stories and turns their ring grey once they are watched", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    getUserStories.mockResolvedValue([story("a"), story("b")]);
    render(
      <StoriesProvider>
        <Ring id="2" />
        <Open author={bob} />
      </StoriesProvider>,
    );
    await waitFor(() => expect(ring("2")).toBe("unseen"));

    fireEvent.click(screen.getByRole("button", { name: "open Bob" }));
    await screen.findByRole("dialog", { name: "Bob's story" });
    expect(screen.getByText("true")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Next story" }));
    // Both are watched, but the rings elsewhere only follow when the player closes.
    expect(ring("2")).toBe("unseen");

    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(ring("2")).toBe("seen"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("deleting your own story from the player asks for your ring again instead of keeping the old one", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "1", hasUnseen: true }]);
    getUserStories.mockResolvedValue([story("mine", { userId: "1", status: "ACTIVE", viewCount: 0 })]);
    deleteStory.mockResolvedValue(undefined);
    render(
      <StoriesProvider>
        <Ring id="1" />
        <Open author={me} />
      </StoriesProvider>,
    );
    await waitFor(() => expect(ring("1")).toBe("unseen"));
    fireEvent.click(screen.getByRole("button", { name: "open Me" }));

    // The server has nothing left to show for them once the story is gone.
    getStoryRings.mockResolvedValueOnce([]);
    fireEvent.click(await screen.findByRole("button", { name: "Delete story" }));
    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteStory).toHaveBeenCalledWith("mine"));
    // The player closes on delete with the story it was handed still in its groups; the ring comes
    // from the server's next answer, not from them.
    await waitFor(() => expect(getStoryRings).toHaveBeenCalledTimes(2));
    expect(ring("1")).toBe("none");
  });

  it("reads their stories again when the owner changes one, and keeps playing", async () => {
    getUserStories.mockResolvedValue([story("mine", { userId: "1", status: "ACTIVE", viewCount: 0 })]);
    render(
      <StoriesProvider>
        <Open author={me} />
      </StoriesProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "open Me" }));

    fireEvent.change(await screen.findByRole("combobox", { name: "Who can see this story" }), {
      target: { value: "FRIENDS" },
    });

    await waitFor(() => expect(getUserStories).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("dialog", { name: "Me's story" })).toBeTruthy();
  });

  it("shows no ring for an id that is not a backend account, and never asks about it", async () => {
    vi.useFakeTimers();
    render(
      <StoriesProvider>
        <Ring id="template-7" />
        <Ring id="2" />
      </StoriesProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(200);
    });

    expect(getStoryRings).toHaveBeenCalledTimes(1);
    expect(getStoryRings).toHaveBeenCalledWith(["2"]);
    expect(ring("template-7")).toBe("none");
  });

  it("shows no ring outside a provider, and opening resolves false", async () => {
    render(
      <>
        <Ring id="2" />
        <Open author={bob} />
      </>,
    );

    expect(ring("2")).toBe("none");
    fireEvent.click(screen.getByRole("button", { name: "open Bob" }));

    expect(await screen.findByText("false")).toBeTruthy();
    expect(getStoryRings).not.toHaveBeenCalled();
    expect(getUserStories).not.toHaveBeenCalled();
  });

  it("renders no ring on the server", () => {
    const html = renderToString(
      <StoriesProvider>
        <Ring id="2" />
      </StoriesProvider>,
    );

    expect(html).toContain(">none<");
    expect(getStoryRings).not.toHaveBeenCalled();
  });
});

describe("a profile header's avatar", () => {
  it("turns their ring grey elsewhere when its player closes", async () => {
    getStoryRings.mockResolvedValueOnce([{ userId: "2", hasUnseen: true }]);
    getUserStories.mockResolvedValue([story("a")]);
    render(
      <StoriesProvider>
        <Ring id="2" />
        <ProfileStoryAvatar author={bob} />
      </StoriesProvider>,
    );
    await waitFor(() => expect(ring("2")).toBe("unseen"));

    fireEvent.click(await screen.findByRole("button", { name: "Watch Bob's stories" }));
    await screen.findByRole("dialog", { name: "Bob's story" });
    fireEvent.click(screen.getByRole("button", { name: "Close" }));

    await waitFor(() => expect(ring("2")).toBe("seen"));
  });

  it("is red on your own profile while a story of yours is live, and grey while none is", async () => {
    getUserStories.mockResolvedValue([story("mine", { userId: "1", status: "ACTIVE" })]);
    const live = render(
      <StoriesProvider>
        <ProfileStoryAvatar author={me} />
      </StoriesProvider>,
    );
    expect(ringClasses(await screen.findByRole("button", { name: "Watch Me's stories" }))).toContain("tt-red");
    live.unmount();

    getUserStories.mockResolvedValue([story("mine", { userId: "1", status: "PENDING_MODERATION" })]);
    render(
      <StoriesProvider>
        <ProfileStoryAvatar author={me} />
      </StoriesProvider>,
    );
    expect(ringClasses(await screen.findByRole("button", { name: "Watch Me's stories" }))).toContain("bg-white/30");
  });
});
