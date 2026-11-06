import { act, renderHook } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

import { PULSE_SETTLE_MS, useStudioPulse } from "@/hooks/use-studio-pulse";

const topics = vi.hoisted(() => new Map<string, (body: string) => void>());
vi.mock("@/lib/realtime/stompClient", () => ({
  subscribeTopic: (destination: string, onBody: (body: string) => void) => {
    topics.set(destination, onBody);
    return () => topics.delete(destination);
  },
}));
vi.mock("@/components/session/SessionProvider", () => ({ useSession: () => ({ user: null }) }));

afterEach(() => {
  vi.useRealTimers();
  topics.clear();
});

it("asks again once a burst of frames has had time to be counted", async () => {
  vi.useFakeTimers();
  const onPulse = vi.fn();
  renderHook(() => useStudioPulse("/topic/users.7", onPulse));

  const frame = () => topics.get("/topic/users.7")!(JSON.stringify({ type: "stats", userId: "7", totalLikes: 3 }));
  act(() => {
    frame();
    frame();
  });
  await act(() => vi.advanceTimersByTimeAsync(PULSE_SETTLE_MS - 1));
  expect(onPulse).not.toHaveBeenCalled();
  await act(() => vi.advanceTimersByTimeAsync(1));
  expect(onPulse).toHaveBeenCalledTimes(1);

  // The next like is a new pulse.
  act(() => frame());
  await act(() => vi.advanceTimersByTimeAsync(PULSE_SETTLE_MS));
  expect(onPulse).toHaveBeenCalledTimes(2);
});

it("stops listening when the page goes", () => {
  const { unmount } = renderHook(() => useStudioPulse("/topic/videos.9", vi.fn()));
  expect(topics.has("/topic/videos.9")).toBe(true);
  unmount();
  expect(topics.has("/topic/videos.9")).toBe(false);
});
