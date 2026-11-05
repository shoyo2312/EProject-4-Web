import { afterEach, describe, expect, it, vi } from "vitest";

import { announceVideoChange, onVideoChange } from "@/lib/video-events";
import type { VideoResponse } from "@/lib/api/types";

const video = { id: "1001", pinnedAt: "2026-11-05T00:00:00Z" } as VideoResponse;

describe("video-events", () => {
  const stops: (() => void)[] = [];
  afterEach(() => stops.splice(0).forEach((stop) => stop()));

  it("tells every listener in this tab about a change", () => {
    const a = vi.fn();
    const b = vi.fn();
    stops.push(onVideoChange(a), onVideoChange(b));

    announceVideoChange({ kind: "updated", video });

    expect(a).toHaveBeenCalledWith({ kind: "updated", video });
    expect(b).toHaveBeenCalledWith({ kind: "updated", video });
  });

  it("stops telling a listener once it unsubscribes", () => {
    const listener = vi.fn();
    onVideoChange(listener)();

    announceVideoChange({ kind: "deleted", videoId: "1001" });

    expect(listener).not.toHaveBeenCalled();
  });

  it("hands the change to other tabs through a BroadcastChannel", async () => {
    // Two channels on one name stand in for two tabs: a message posted on one reaches the other.
    const otherTab = new BroadcastChannel("tt:videos");
    const received = new Promise((resolve) => otherTab.addEventListener("message", (event) => resolve(event.data)));

    announceVideoChange({ kind: "deleted", videoId: "1001" });

    await expect(received).resolves.toEqual({ kind: "deleted", videoId: "1001" });
    otherTab.close();
  });
});
