import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, renderHook, waitFor } from "@testing-library/react";
import { useEffect, useState } from "react";

import { useVideoChanges } from "@/hooks/use-video-changes";
import { ApiError } from "@/lib/api/errors";
import type { VideoResponse } from "@/lib/api/types";
import { announceVideoChange } from "@/lib/video-events";

const frames = new Map<string, (body: string) => void>();
vi.mock("@/lib/realtime/stompClient", () => ({
  subscribeTopic: (destination: string, onMessage: (body: string) => void) => {
    frames.set(destination, onMessage);
    return () => frames.delete(destination);
  },
}));

const getVideo = vi.fn();
const getVideosByIds = vi.fn();
vi.mock("@/lib/api/videos", () => ({
  getVideo: (...args: unknown[]) => getVideo(...args),
  getVideosByIds: (...args: unknown[]) => getVideosByIds(...args),
}));

const video = (id: string, extra: Partial<VideoResponse> = {}) => ({ id, ...extra }) as VideoResponse;

const mount = (ids: string[]) => {
  const onUpdated = vi.fn();
  const onDeleted = vi.fn();
  renderHook(() => useVideoChanges(ids, { onUpdated, onDeleted }));
  return { onUpdated, onDeleted };
};

const push = (id: string, frame: object) => frames.get(`/topic/videos.${id}`)?.(JSON.stringify(frame));

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  frames.clear();
});

describe("useVideoChanges", () => {
  it("passes on a change made elsewhere in this browser", () => {
    const { onUpdated, onDeleted } = mount(["1"]);

    announceVideoChange({ kind: "updated", video: video("1", { pinnedAt: "2026-11-05T00:00:00Z" }) });
    announceVideoChange({ kind: "deleted", videoId: "1" });

    expect(onUpdated).toHaveBeenCalledWith(video("1", { pinnedAt: "2026-11-05T00:00:00Z" }));
    expect(onDeleted).toHaveBeenCalledWith("1");
  });

  it("drops a video the server says was deleted, without asking for it again", () => {
    const { onDeleted } = mount(["1"]);

    push("1", { type: "state", videoId: "1", status: "DELETED" });

    expect(onDeleted).toHaveBeenCalledWith("1");
    expect(getVideo).not.toHaveBeenCalled();
  });

  it("refetches a video on any other state frame, since the frame is only a hint", async () => {
    getVideo.mockResolvedValueOnce(video("1", { visibility: "PRIVATE" }));
    const { onUpdated } = mount(["1"]);

    push("1", { type: "state", videoId: "1", visibility: "PRIVATE" });

    await waitFor(() => expect(onUpdated).toHaveBeenCalledWith(video("1", { visibility: "PRIVATE" })));
  });

  it("treats a refetch that answers 404 as gone", async () => {
    getVideo.mockRejectedValueOnce(new ApiError(404, "VIDEO_NOT_FOUND", "gone"));
    const { onDeleted } = mount(["1"]);

    push("1", { type: "state", videoId: "1", status: "TAKEN_DOWN" });

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("1"));
  });

  it("ignores count frames, which carry nothing a list of posts shows", () => {
    const { onUpdated, onDeleted } = mount(["1"]);

    push("1", { type: "counts", videoId: "1", likeCount: 3 });

    expect(getVideo).not.toHaveBeenCalled();
    expect(onUpdated).not.toHaveBeenCalled();
    expect(onDeleted).not.toHaveBeenCalled();
  });

  it("reaches the handler of the render just committed, before that render's effects have run", async () => {
    // A list re-rendered by an API answer commits its rows, then runs its effects in a later task. A
    // change announced in between must still see those rows, not the previous render's.
    const seen: string[] = [];
    function List() {
      const [rows, setRows] = useState("none");
      useEffect(() => {
        void Promise.resolve().then(() => setRows("loaded"));
      }, []);
      useVideoChanges(["1"], { onUpdated: () => seen.push(rows), onDeleted: () => {} });
      return <p>{rows}</p>;
    }
    // Outside act: the answer's render goes through React's own scheduler, as in the app.
    const flags = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
    const actEnvironment = flags.IS_REACT_ACT_ENVIRONMENT;
    flags.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      const { container } = render(<List />);
      await new Promise<void>((done) => {
        new MutationObserver((_, observer) => {
          if (container.textContent !== "loaded") return;
          observer.disconnect();
          announceVideoChange({ kind: "updated", video: video("1") });
          done();
        }).observe(container, { childList: true, subtree: true, characterData: true });
      });
    } finally {
      flags.IS_REACT_ACT_ENVIRONMENT = actEnvironment;
    }

    expect(seen).toEqual(["loaded"]);
  });

  it("rechecks every video when the tab comes back, dropping the ones no longer there", async () => {
    getVideosByIds.mockResolvedValueOnce([video("1", { pinnedAt: "2026-11-05T00:00:00Z" })]);
    const { onUpdated, onDeleted } = mount(["1", "2"]);

    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("2"));
    expect(getVideosByIds).toHaveBeenCalledWith(["1", "2"]);
    expect(onUpdated).toHaveBeenCalledWith(video("1", { pinnedAt: "2026-11-05T00:00:00Z" }));
  });
});
