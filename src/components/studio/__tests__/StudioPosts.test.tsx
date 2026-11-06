import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { SETTLE_POLL_MS, StudioPosts } from "@/components/studio/StudioPosts";
import type { PageResponse, VideoResponse } from "@/lib/api/types";
import { announceVideoChange } from "@/lib/video-events";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));
// Rows subscribe to their video's topic; a test must not open a socket to whatever is on :8080.
vi.mock("@/lib/realtime/stompClient", () => ({ subscribeTopic: () => () => {} }));

const listStudioPosts = vi.fn();
vi.mock("@/lib/api/studio", () => ({
  listStudioPosts: (...args: unknown[]) => listStudioPosts(...args),
}));
const getVideo = vi.fn();
vi.mock("@/lib/api/videos", async (original) => ({
  ...(await original<typeof import("@/lib/api/videos")>()),
  getVideo: (...args: unknown[]) => getVideo(...args),
}));

const post = (id: string, title: string): VideoResponse => ({
  id,
  userId: "1",
  title,
  description: null,
  thumbnailUrl: null,
  hlsUrl: null,
  durationSeconds: 10,
  status: "PUBLISHED",
  visibility: "PUBLIC",
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  commentsDisabled: false,
  accountCommentsOff: false,
  width: null,
  height: null,
  createdAt: "2026-11-01T00:00:00Z",
});

const page = (content: VideoResponse[], number: number, totalPages: number): PageResponse<VideoResponse> => ({
  content,
  page: { size: 20, number, totalElements: totalPages * 20, totalPages },
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const loader = () => screen.queryByRole("status", { name: "Loading" });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioPosts", () => {
  it("shows the error, not the loading dots, when the first page fails", async () => {
    listStudioPosts.mockRejectedValueOnce(new Error("gateway down"));

    render(<StudioPosts />);

    expect(await screen.findByText("Something went wrong. Please try again.")).toBeTruthy();
    expect(loader()).toBeNull();
  });

  it("drops a late page of the previous query instead of appending it under the new one", async () => {
    const latePage = deferred<PageResponse<VideoResponse>>();
    listStudioPosts
      .mockResolvedValueOnce(page([post("1", "first of old")], 0, 2))
      .mockReturnValueOnce(latePage.promise)
      .mockResolvedValueOnce(page([post("3", "only of new")], 0, 1));

    render(<StudioPosts />);
    await screen.findByText("first of old");

    fireEvent.click(screen.getByRole("button", { name: "Load more" }));
    fireEvent.click(screen.getByRole("button", { name: /^Sort by Views/ }));
    await screen.findByText("only of new");

    await act(async () => {
      latePage.resolve(page([post("2", "second of old")], 1, 2));
      await latePage.promise;
    });

    expect(screen.queryByText("second of old")).toBeNull();
    expect(screen.getByText("only of new")).toBeTruthy();
    expect(loader()).toBeNull();
  });

  it("asks for the next page once however fast Load more is clicked, and never repeats a row", async () => {
    const next = deferred<PageResponse<VideoResponse>>();
    listStudioPosts.mockResolvedValueOnce(page([post("1", "first")], 0, 2)).mockReturnValueOnce(next.promise);

    render(<StudioPosts />);
    const button = await screen.findByRole("button", { name: "Load more" });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(listStudioPosts).toHaveBeenCalledTimes(2);

    // A new post shifted the offset pages: the next page starts with the row already shown.
    await act(async () => {
      next.resolve(page([post("1", "first"), post("2", "second")], 1, 2));
      await next.promise;
    });

    expect(screen.getAllByText("first")).toHaveLength(1);
    expect(screen.getByText("second")).toBeTruthy();
  });

  it("asks for the first page again when a row is pinned, since pinned posts lead the default order", async () => {
    const older = post("1", "Older");
    const newer = post("2", "Newer");
    listStudioPosts.mockResolvedValueOnce(page([newer, older], 0, 1));
    render(<StudioPosts />);
    await screen.findByText("Older");

    const pinned = { ...older, pinnedAt: "2026-11-05T00:00:00Z" };
    listStudioPosts.mockResolvedValueOnce(page([pinned, newer], 0, 1));
    act(() => announceVideoChange({ kind: "updated", video: pinned }));

    await waitFor(() =>
      expect(screen.getAllByText(/^(Older|Newer)$/).map((title) => title.textContent)).toEqual(["Older", "Newer"]),
    );
    expect(listStudioPosts).toHaveBeenCalledTimes(2);
  });

  it("only patches the row while the owner sorts by a column, which pins do not move", async () => {
    const older = post("1", "Older");
    listStudioPosts.mockResolvedValue(page([older], 0, 1));
    render(<StudioPosts />);
    await screen.findByText("Older");
    fireEvent.click(screen.getByRole("button", { name: "Sort by Views" }));
    await waitFor(() => expect(listStudioPosts).toHaveBeenCalledTimes(2));
    listStudioPosts.mockClear();

    act(() => announceVideoChange({ kind: "updated", video: { ...older, pinnedAt: "2026-11-05T00:00:00Z" } }));

    expect(await screen.findByText("Pinned")).toBeTruthy();
    expect(listStudioPosts).not.toHaveBeenCalled();
  });
});

describe("StudioPosts — moderation status", () => {
  it("refetches only the rows still being checked until their verdict lands", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      const checking = { ...post("2", "Fresh upload"), status: "PENDING_MODERATION" as const };
      listStudioPosts.mockResolvedValue(page([post("1", "Old post"), checking], 0, 1));
      getVideo.mockResolvedValue({ ...checking, status: "PUBLISHED" });

      render(<StudioPosts />);
      await screen.findByText("Fresh upload");
      expect(screen.getByText("Under review")).toBeTruthy();

      await act(() => vi.advanceTimersByTimeAsync(SETTLE_POLL_MS));
      expect(getVideo).toHaveBeenCalledTimes(1);
      expect(getVideo.mock.calls[0][0]).toBe("2");
      expect(screen.queryByText("Under review")).toBeNull();

      // Settled: nothing left to poll.
      await act(() => vi.advanceTimersByTimeAsync(SETTLE_POLL_MS * 3));
      expect(getVideo).toHaveBeenCalledTimes(1);
      expect(listStudioPosts).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }
  });
});
