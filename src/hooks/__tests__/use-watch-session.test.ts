import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

import { useWatchSession } from "@/hooks/use-watch-session";

const recordWatch = vi.fn<(...args: unknown[]) => Promise<void>>(() => Promise.resolve());
vi.mock("@/lib/api/interactions", () => ({
  recordWatch: (...args: unknown[]) => recordWatch(...args),
  recordView: () => Promise.resolve(),
}));
vi.mock("@/lib/last-watched", () => ({ markLastWatched: () => undefined }));

// Never 0: the hook reads a zero start as "paused".
let clock = 100;

beforeEach(() => {
  clock = 100;
  vi.spyOn(performance, "now").mockImplementation(() => clock);
});

afterEach(() => {
  vi.restoreAllMocks();
  recordWatch.mockClear();
});

function watch(source: "SEARCH" | "FOR_YOU", searchQuery?: string) {
  const { unmount } = renderHook(() =>
    useWatchSession({ videoId: "7", isActive: true, isPlaying: true, duration: 10, enabled: true, source, searchQuery }),
  );
  clock = 1600;
  unmount();
}

describe("useWatchSession", () => {
  it("flushSendsTheSource", () => {
    watch("SEARCH", "tiny house");

    expect(recordWatch).toHaveBeenCalledWith("7", 1500, 10_000, "SEARCH", "tiny house");
  });

  it("queryIsOnlySentForSearch", () => {
    watch("FOR_YOU", "tiny house");

    expect(recordWatch).toHaveBeenCalledWith("7", 1500, 10_000, "FOR_YOU", undefined);
  });
});
