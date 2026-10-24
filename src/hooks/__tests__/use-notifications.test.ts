import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";

import { useNotifications } from "@/hooks/use-notifications";
import type { NotificationFrame } from "@/hooks/use-notification-realtime";
import type { NotificationResponse } from "@/lib/api/notifications";

let user: { userId: string } | null = { userId: "1" };
vi.mock("@/components/session/SessionProvider", () => ({
  useSession: () => ({ user }),
}));

const listNotifications = vi.fn<() => Promise<NotificationResponse[]>>();
const getUnreadCount = vi.fn<() => Promise<number>>();
// The real module underneath, so referencesUser — which the hook calls once an entry has a
// referenceId — is the real one.
vi.mock("@/lib/api/notifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/notifications")>()),
  listNotifications: () => listNotifications(),
  getUnreadCount: () => getUnreadCount(),
  markAllNotificationsRead: vi.fn(),
  markNotificationRead: vi.fn(),
}));
vi.mock("@/lib/api/users", () => ({ getProfiles: async () => [], MAX_PROFILE_BATCH: 100 }));
const getVideosByIds = vi.fn<(ids: string[]) => Promise<unknown[]>>(async () => []);
vi.mock("@/lib/api/videos", () => ({ getVideosByIds: (ids: string[]) => getVideosByIds(ids) }));
vi.mock("@/lib/settings/browser-notifications", () => ({ showBrowserNotification: vi.fn() }));

let relay: (frame: NotificationFrame) => void = () => {};
vi.mock("@/hooks/use-notification-realtime", () => ({
  useNotificationRealtime: (_on: boolean, onFrame: (frame: NotificationFrame) => void) => {
    relay = onFrame;
  },
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

  it("does not count a relayed copy of an entry the list already has", async () => {
    listNotifications.mockResolvedValue([entry]);
    getUnreadCount.mockResolvedValue(1);
    const { result } = renderHook(() => useNotifications());
    await waitFor(() => expect(result.current.loaded).toBe(true));

    act(() =>
      relay({
        notificationId: "n1",
        recipientId: "1",
        actorId: null,
        type: "SYSTEM",
        title: "hi",
        body: "",
        referenceId: null,
        createdAt: entry.createdAt,
      }),
    );

    expect(result.current.items).toHaveLength(1);
    expect(result.current.unreadCount).toBe(1);
  });

  /** Its referenceId is the web's cue for the "Secure your account" link, not a video. */
  it("never looks up a video for an account-security notice", async () => {
    listNotifications.mockResolvedValue([{ ...entry, referenceId: "account-security" }]);
    getUnreadCount.mockResolvedValue(1);
    const { result } = renderHook(() => useNotifications());

    await waitFor(() => expect(result.current.loaded).toBe(true));

    expect(getVideosByIds).not.toHaveBeenCalled();
  });
});
