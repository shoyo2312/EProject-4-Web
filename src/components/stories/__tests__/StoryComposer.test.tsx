import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { StoryComposer } from "@/components/stories/StoryComposer";
import { toast } from "@/components/ui/toast";

vi.mock("@/components/stories/StoriesProvider", () => ({
  useStories: () => ({ openStories: async () => false, syncRings: () => {}, invalidateOwnRing: () => {} }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { success: vi.fn(), warning: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/api/stories", () => ({
  createStoryUploadUrl: async () => ({ uploadUrl: "https://storage/up", formFields: {}, fileUrl: "s3://b/k.jpg", expiresInSeconds: 60 }),
  createStory: async () => ({ id: "s1", userId: "1", status: "PENDING_MODERATION" }),
}));
const uploadToStorage = vi.fn(async () => undefined);
vi.mock("@/lib/api/videos", () => ({ uploadToStorage: (...args: unknown[]) => uploadToStorage(...(args as [])) }));

function renderComposer(props: Partial<{ closing: boolean; onClose: () => void; onPosted: () => void }> = {}) {
  return render(
    <StoryComposer
      closing={props.closing ?? false}
      onClose={props.onClose ?? (() => {})}
      onPosted={props.onPosted ?? (() => {})}
    />,
  );
}

function chooseImage() {
  const input = document.querySelector("input[type=file]") as HTMLInputElement;
  const file = new File(["x"], "pic.jpg", { type: "image/jpeg" });
  fireEvent.change(input, { target: { files: [file] } });
}

beforeEach(() => {
  vi.stubGlobal("URL", { ...URL, createObjectURL: () => "blob:pic", revokeObjectURL: () => {} });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StoryComposer", () => {
  it("shows the posted check and calls onPosted at once, then asks to close after 700ms", async () => {
    const onPosted = vi.fn();
    const onClose = vi.fn();
    renderComposer({ onPosted, onClose });
    chooseImage();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(onPosted).toHaveBeenCalledOnce());
    expect(screen.getByText("Posted")).toBeTruthy();
    expect(toast.success).toHaveBeenCalledWith("Story posted — it'll go live after a quick review");
    expect(onClose).not.toHaveBeenCalled();

    await waitFor(() => expect(onClose).toHaveBeenCalledOnce(), { timeout: 1500 });
  });

  it("is inert with the card shrinking while closing", () => {
    renderComposer({ closing: true });

    const dialog = screen.getByRole("dialog", { hidden: true });
    expect(dialog.closest("[inert]")).not.toBeNull();
    expect(dialog.className).toContain("scale-10");
  });

  it("dims the preview while posting", async () => {
    let finish: () => void = () => {};
    uploadToStorage.mockImplementationOnce(() => new Promise<undefined>((resolve) => { finish = () => resolve(undefined); }));
    renderComposer();
    chooseImage();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(document.querySelector("[data-preview]")?.className).toContain("opacity-60"));
    act(() => finish());
  });
});
