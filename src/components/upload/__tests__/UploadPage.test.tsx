import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { UploadPage } from "@/components/upload/UploadPage";
import { toast } from "@/components/ui/toast";
import { ApiError } from "@/lib/api/errors";
import type { UploadUrlResponse, VideoResponse, VideoStatus } from "@/lib/api/types";

const replace = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace }) }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1" }, isLoading: false, openLogin: () => {} }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const createUploadUrl = vi.fn();
const uploadToStorage = vi.fn();
const createVideo = vi.fn();
const pollUntilReady = vi.fn();
vi.mock("@/lib/api/videos", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/videos")>()),
  createUploadUrl: (...args: unknown[]) => createUploadUrl(...args),
  uploadToStorage: (...args: unknown[]) => uploadToStorage(...args),
  createVideo: (...args: unknown[]) => createVideo(...args),
  pollUntilReady: (...args: unknown[]) => pollUntilReady(...args),
}));

const RAW = "s3://video-media/raw/1/7312.mp4";

const target: UploadUrlResponse = {
  uploadUrl: "https://minio.local/video-media",
  formFields: { key: "raw/1/7312.mp4" },
  fileUrl: RAW,
  expiresInSeconds: 600,
};

const video = (status: VideoStatus): Partial<VideoResponse> => ({
  id: "42",
  userId: "1",
  title: "A fixed title",
  status,
  failureReason: null,
});

beforeEach(() => {
  // jsdom makes no object URLs and decodes no media. The duration probe then
  // errors, which the page reads as "let the server judge the length".
  URL.createObjectURL = () => "blob:clip";
  URL.revokeObjectURL = () => {};
  const create = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(
    (tag: string, options?: ElementCreationOptions) => {
      const element = create(tag, options);
      if (tag === "video") {
        queueMicrotask(() => (element as HTMLVideoElement).onerror?.(new Event("error")));
      }
      return element;
    },
  );
  createUploadUrl.mockResolvedValue(target);
  uploadToStorage.mockResolvedValue(undefined);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

/** Picks a clip; the title is prefilled from its file name. */
async function chooseClip() {
  const { container } = render(<UploadPage />);
  const picker = container.querySelector<HTMLInputElement>('input[type="file"]');
  fireEvent.change(picker as HTMLInputElement, {
    target: { files: [new File(["bytes"], "clip.mp4", { type: "video/mp4" })] },
  });
  return screen.findByRole<HTMLInputElement>("textbox", { name: /^Title/ });
}

describe("UploadPage", () => {
  it.each([
    ["VIDEO_TITLE_REJECTED", /^Title/],
    ["VIDEO_DESCRIPTION_REJECTED", /^Description/],
    ["VIDEO_TAGS_REJECTED", /^Description/],
  ])("puts %s under the field it names", async (code, field) => {
    createVideo.mockRejectedValue(new ApiError(422, code, "caption refused"));
    await chooseClip();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() =>
      expect(screen.getByRole("textbox", { name: field }).getAttribute("aria-invalid")).toBe(
        "true",
      ),
    );
    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("holds Post until the posting limit lifts, and says when", async () => {
    createVideo.mockRejectedValue(new ApiError(429, "UPLOAD_RATE_LIMITED", "too many", 1800));
    await chooseClip();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    expect(await screen.findByText(/You can post again on/)).toBeTruthy();
    expect(screen.getByRole<HTMLButtonElement>("button", { name: "Post" }).disabled).toBe(true);
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("publishes the same upload again once the caption is fixed", async () => {
    createVideo
      .mockRejectedValueOnce(new ApiError(422, "VIDEO_TITLE_REJECTED", "caption refused"))
      .mockResolvedValueOnce(video("PROCESSING"));
    pollUntilReady.mockResolvedValue(video("PUBLISHED"));
    const title = await chooseClip();

    fireEvent.click(screen.getByRole("button", { name: "Post" }));
    await waitFor(() => expect(title.getAttribute("aria-invalid")).toBe("true"));
    fireEvent.change(title, { target: { value: "A fixed title" } });
    fireEvent.click(screen.getByRole("button", { name: "Post" }));

    await waitFor(() => expect(replace).toHaveBeenCalledWith("/video/42"));
    expect(uploadToStorage).toHaveBeenCalledTimes(1);
    expect(createVideo).toHaveBeenLastCalledWith(
      expect.objectContaining({ title: "A fixed title", rawFileUrl: RAW }),
    );
  });
});
