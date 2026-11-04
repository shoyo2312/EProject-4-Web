import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";

import { StudioEditPost } from "@/components/studio/StudioEditPost";
import type { VideoResponse } from "@/lib/api/types";

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn() }) }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: { userId: "1", username: "me", displayName: "Me", avatarUrl: null }, isLoading: false }),
}));
vi.mock("@/components/ui/toast", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const getVideo = vi.fn();
vi.mock("@/lib/api/videos", () => ({
  getVideo: (...args: unknown[]) => getVideo(...args),
  updateVideoCaption: vi.fn(),
  updateVideoCommentsSetting: vi.fn(),
  updateVideoVisibility: vi.fn(),
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
  visibility: "PRIVATE",
  viewCount: 0,
  likeCount: 0,
  commentCount: 0,
  commentsDisabled: false,
  accountCommentsOff: false,
  width: null,
  height: null,
  createdAt: "2026-11-01T00:00:00Z",
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("StudioEditPost", () => {
  it("re-seeds the form when the route moves to another video", async () => {
    getVideo.mockResolvedValueOnce(post("1001", "Title of A")).mockResolvedValueOnce(post("1002", "Title of B"));

    const { rerender } = render(<StudioEditPost videoId="1001" />);
    await screen.findByDisplayValue("Title of A");

    rerender(<StudioEditPost videoId="1002" />);

    expect(await screen.findByDisplayValue("Title of B")).toBeTruthy();
    expect(screen.queryByDisplayValue("Title of A")).toBeNull();
  });

  it("names a private post the way the Posts table does", async () => {
    getVideo.mockResolvedValueOnce(post("1001", "Title of A"));

    render(<StudioEditPost videoId="1001" />);
    await screen.findByDisplayValue("Title of A");
    fireEvent.click(screen.getByRole("button", { name: /Only/ }));

    expect(screen.getByRole("option", { name: /Only me/ })).toBeTruthy();
  });
});
