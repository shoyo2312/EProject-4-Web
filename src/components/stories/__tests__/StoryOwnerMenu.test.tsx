import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";

import { StoryOwnerMenu } from "@/components/stories/StoryOwnerMenu";
import { toast } from "@/components/ui/toast";
import type { StoryResponse } from "@/lib/api/types";

const invalidateOwnRing = vi.fn();
vi.mock("@/components/stories/StoriesProvider", () => ({
  useStories: () => ({ openStories: async () => false, syncRings: () => {}, invalidateOwnRing }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
const updateStoryVisibility = vi.fn<(id: string, visibility: string) => Promise<unknown>>(async () => ({}));
const deleteStory = vi.fn<(id: string) => Promise<void>>(async () => undefined);
vi.mock("@/lib/api/stories", () => ({
  updateStoryVisibility: (id: string, visibility: string) => updateStoryVisibility(id, visibility),
  deleteStory: (id: string) => deleteStory(id),
}));

const mine: StoryResponse = {
  id: "mine",
  userId: "1",
  mediaUrl: "https://media/mine.jpg",
  mediaType: "IMAGE",
  caption: null,
  visibility: "PUBLIC",
  status: "ACTIVE",
  durationSeconds: null,
  viewCount: 0,
  viewedByMe: false,
  myReaction: null,
  reactionCounts: null,
  createdAt: "2026-10-20T10:00:00Z",
  expiresAt: "2026-10-21T10:00:00Z",
};

function renderMenu(props: Partial<{ onChanged: () => void; onDeleted: () => void; onBusy: (busy: boolean) => void }> = {}) {
  return render(
    <StoryOwnerMenu
      story={mine}
      onChanged={props.onChanged ?? (() => {})}
      onDeleted={props.onDeleted ?? (() => {})}
      onBusy={props.onBusy ?? (() => {})}
    />,
  );
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("StoryOwnerMenu", () => {
  it("opens from the ⋯ button with the audience choices and a delete, and holds playback while open", () => {
    const onBusy = vi.fn();
    renderMenu({ onBusy });
    expect(screen.queryByRole("menu")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "More" }));

    expect(onBusy).toHaveBeenLastCalledWith(true);
    const select = screen.getByRole("combobox", { name: "Who can see this story" }) as HTMLSelectElement;
    expect(select.value).toBe("PUBLIC");
    expect(Array.from(select.options).map((option) => option.textContent)).toEqual(["Everyone", "Friends", "Only you"]);
    expect(select.className).toContain("cursor-pointer");
    expect(screen.queryAllByRole("menuitemradio")).toHaveLength(0);
    expect(screen.getByRole("menuitem", { name: "Delete story" })).toBeTruthy();
  });

  it("changes who can see the story and tells the player", async () => {
    const onChanged = vi.fn();
    renderMenu({ onChanged });
    fireEvent.click(screen.getByRole("button", { name: "More" }));

    const select = screen.getByRole("combobox", { name: "Who can see this story" }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "FRIENDS" } });

    expect(select.value).toBe("FRIENDS");
    await waitFor(() => expect(updateStoryVisibility).toHaveBeenCalledWith("mine", "FRIENDS"));
    await waitFor(() => expect(onChanged).toHaveBeenCalledOnce());
  });

  it("asks before deleting, in a dialog that stays for its exit when cancelled", () => {
    vi.useFakeTimers();
    const onBusy = vi.fn();
    renderMenu({ onBusy });
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete story" }));

    const dialog = screen.getByRole("alertdialog");
    expect(dialog.textContent).toContain("Delete this story?");
    expect(deleteStory).not.toHaveBeenCalled();
    expect(onBusy).toHaveBeenLastCalledWith(true);

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("alertdialog", { hidden: true }).closest("[inert]")).not.toBeNull();
    act(() => vi.advanceTimersByTime(300));
    expect(screen.queryByRole("alertdialog", { hidden: true })).toBeNull();
    expect(onBusy).toHaveBeenLastCalledWith(false);
  });

  it("deletes on confirm, forgets the ring and tells the player", async () => {
    const onDeleted = vi.fn();
    renderMenu({ onDeleted });
    fireEvent.click(screen.getByRole("button", { name: "More" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete story" }));

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteStory).toHaveBeenCalledWith("mine"));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledOnce());
    expect(invalidateOwnRing).toHaveBeenCalledOnce();
    expect(toast.success).toHaveBeenCalledWith("Story deleted");
  });
});
