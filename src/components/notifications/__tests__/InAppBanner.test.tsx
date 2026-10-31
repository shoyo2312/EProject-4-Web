import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { showInAppBanner } from "@/components/notifications/InAppBanner";
import { Toaster } from "@/components/ui/toast";
import type { NotificationFrame } from "@/hooks/use-notification-realtime";

vi.mock("@/lib/api/users", () => ({
  getProfile: vi.fn(async () => ({ userId: "9", avatarUrl: "https://cdn.example/a.png" })),
}));

const frame: NotificationFrame = {
  notificationId: "n1",
  recipientId: "1",
  actorId: "9",
  type: "LIKE",
  title: "New like",
  body: "Someone liked your video.",
  referenceId: "7",
  createdAt: "2026-10-24T12:00:00Z",
};

afterEach(cleanup);

it("shows who did it, and a click opens the inbox", async () => {
  const onOpen = vi.fn();
  render(<Toaster />);

  act(() => showInAppBanner(frame, onOpen));

  const banner = await screen.findByRole("button", { name: /New like/ });
  expect(screen.getByText("Someone liked your video.")).toBeTruthy();
  await waitFor(() =>
    expect(banner.querySelector("img")?.getAttribute("src")).toBe("https://cdn.example/a.png"),
  );

  fireEvent.click(banner);
  expect(onOpen).toHaveBeenCalledTimes(1);
});
