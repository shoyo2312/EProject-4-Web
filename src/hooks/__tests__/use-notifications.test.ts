import { afterEach, describe, expect, it, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

import { useNotifications } from "@/hooks/use-notifications";
import type { NotificationResponse } from "@/lib/api/notifications";

let user: { userId: string } | null = { userId: "1" };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user }),
}));

const listNotifications = vi.fn<() => Promise<NotificationResponse[]>>();
const getUnreadCount = vi.fn<() => Promise<number>>();
vi.mock("@/lib/api/notifications", () => ({
  listNotifications: () => listNotifications(),
  getUnreadCount: () => getUnreadCount(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
vi.mock("@/lib/api/users", () => ({ getProfiles: async () => [], MAX_PROFILE_BATCH: 100 }));
vi.mock("@/lib/api/videos", () => ({ getVideosByIds: async () => [] }));
vi.mock("@/lib/settings/browser-notifications", () => ({ showBrowserNotification: vi.fn() }));

vi.mock("@/hooks/use-notification-realtime", () => ({
  useNotificationRealtime: () => {},
}));

const entry: NotificationResponse = {
  id: "n1",
  actorId: null,
  type: "SYSTEM",
  title: "hi",
  body: "",
  referenceId: null,
  read: false,
  createdAt: "2026-10-01T00:00:00Z",
};

afterEach(() => {
  user = { userId: "1" };
  listNotifications.mockReset();
  getUnreadCount.mockReset();
});

describe("useNotifications", () => {
  it("drops the previous account's inbox the moment the viewer changes", async () => {
    listNotifications.mockResolvedValueOnce([entry]).mockReturnValue(new Promise(() => {}));
    getUnreadCount.mockResolvedValueOnce(1).mockReturnValue(new Promise(() => {}));
    const { result, rerender } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.items).toHaveLength(1));

    user = { userId: "2" };
    rerender();

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.loaded).toBe(false);
  });
});
