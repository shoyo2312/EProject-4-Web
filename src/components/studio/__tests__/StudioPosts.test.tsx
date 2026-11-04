import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

import { StudioPosts } from "@/components/studio/StudioPosts";
import type { PageResponse, VideoResponse } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const listStudioPosts = vi.fn();
vi.mock("@/lib/api/studio", () => ({
  listStudioPosts: (...args: unknown[]) => listStudioPosts(...args),
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
});
