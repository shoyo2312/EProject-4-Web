import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

import { BackendProfilePage } from "@/components/profile/BackendProfilePage";
import type { VideoResponse } from "@/lib/api/types";
import { getProfile } from "@/lib/api/users";
import { getUserVideos } from "@/lib/api/videos";
import type { UserProfile } from "@/types/tiktok";

type Handlers = { onUpdated: (video: VideoResponse) => void; onDeleted: (videoId: string) => void };
const live: { handlers: Handlers | null } = { handlers: null };

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user: null, isLoading: false }),
}));
vi.mock("@/hooks/use-user-realtime", () => ({ useUserRealtime: () => {} }));
vi.mock("@/hooks/use-video-changes", () => ({
  useVideoChanges: (_ids: string[], handlers: Handlers) => {
    live.handlers = handlers;
  },
}));
vi.mock("@/components/profile/ProfilePage", () => ({
  ProfilePage: ({ profile }: { profile: UserProfile }) => (
    <p data-testid="grid">
      {profile.author.userId}|{profile.posts.videos.map((video) => `${video.id}:${video.views}`).join(",")}
    </p>
  ),
}));
vi.mock("@/lib/api/users", () => ({
  getProfile: vi.fn(async (userId: string) => ({ userId })),
  getFriendship: vi.fn(async () => null),
}));
vi.mock("@/lib/api/videos", () => ({
  getUserVideos: vi.fn(),
  getUserVideoStats: vi.fn(async () => null),
  getVideosByIds: vi.fn(async () => []),
}));
vi.mock("@/lib/api/adapters", () => ({
  authorFromProfile: (raw: { userId: string }) => ({ userId: raw.userId }),
  profileToUserProfile: (_raw: unknown, author: { userId: string }, videos: unknown[]) => ({
    author,
    posts: { videos, reposts: [], favorites: [], liked: [] },
  }),
  videoToProfileVideo: (video: VideoResponse) => ({
    id: video.id,
    views: video.viewCount,
    isPinned: Boolean(video.pinnedAt),
  }),
}));

const video = (id: string, userId: string, extra: Partial<VideoResponse> = {}) =>
  ({ id, userId, viewCount: 0, pinnedAt: null, ...extra }) as VideoResponse;
const page = (videos: VideoResponse[]) => ({ content: videos, page: { number: 0, totalPages: 1 } });

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const grid = () => screen.getByTestId("grid").textContent;
const userVideos = vi.mocked(getUserVideos);

beforeEach(() => {
  live.handlers = null;
  userVideos.mockReset();
});
afterEach(cleanup);

it("keeps every patch from one recheck, not just the last", async () => {
  userVideos.mockResolvedValue(page([video("a", "7"), video("b", "7")]) as never);
  render(<BackendProfilePage userId="7" />);
  await waitFor(() => expect(grid()).toBe("7|a:0,b:0"));

  act(() => {
    live.handlers!.onUpdated(video("a", "7", { viewCount: 5 }));
    live.handlers!.onUpdated(video("b", "7", { viewCount: 9 }));
  });

  expect(grid()).toBe("7|a:5,b:9");
});

it("drops a grid reload that answers for the profile the viewer already left", async () => {
  const stale = deferred<ReturnType<typeof page>>();
  userVideos.mockResolvedValueOnce(page([video("a", "7")]) as never);
  const { rerender } = render(<BackendProfilePage userId="7" />);
  await waitFor(() => expect(grid()).toBe("7|a:0"));

  userVideos.mockReturnValueOnce(stale.promise as never);
  act(() => live.handlers!.onUpdated(video("a", "7", { pinnedAt: "2026-11-05T00:00:00Z" })));

  userVideos.mockResolvedValueOnce(page([video("c", "8")]) as never);
  rerender(<BackendProfilePage userId="8" />);
  await waitFor(() => expect(grid()).toBe("8|c:0"));

  await act(async () => stale.resolve(page([video("a", "7", { pinnedAt: "2026-11-05T00:00:00Z" })])));

  expect(grid()).toBe("8|c:0");
});

it("keeps the newest of two overlapping grid reloads", async () => {
  const older = deferred<ReturnType<typeof page>>();
  const newer = deferred<ReturnType<typeof page>>();
  userVideos.mockResolvedValueOnce(page([video("a", "7"), video("b", "7")]) as never);
  render(<BackendProfilePage userId="7" />);
  await waitFor(() => expect(grid()).toBe("7|a:0,b:0"));

  userVideos.mockReturnValueOnce(older.promise as never).mockReturnValueOnce(newer.promise as never);
  act(() => {
    live.handlers!.onUpdated(video("a", "7", { pinnedAt: "2026-11-05T00:00:00Z" }));
    live.handlers!.onUpdated(video("b", "7", { pinnedAt: "2026-11-05T00:00:01Z" }));
  });

  await act(async () => newer.resolve(page([video("b", "7", { viewCount: 2 }), video("a", "7", { viewCount: 1 })])));
  await act(async () => older.resolve(page([video("a", "7")])));

  expect(grid()).toBe("7|b:2,a:1");
});

it("drops a profile load that answers after the viewer moved to another profile", async () => {
  const stale = deferred<{ userId: string }>();
  vi.mocked(getProfile).mockReturnValueOnce(stale.promise as never);
  userVideos.mockImplementation(async (userId: string) => page([video(userId === "7" ? "a" : "c", userId)]) as never);
  const { rerender } = render(<BackendProfilePage userId="7" />);

  rerender(<BackendProfilePage userId="8" />);
  await waitFor(() => expect(grid()).toBe("8|c:0"));

  await act(async () => stale.resolve({ userId: "7" }));

  expect(grid()).toBe("8|c:0");
});
