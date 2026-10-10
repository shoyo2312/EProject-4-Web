import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";

import { useVideoPlayback } from "@/hooks/use-video-playback";

let observe: IntersectionObserverCallback = () => {};
const setVisible = (isIntersecting: boolean) =>
  act(() => {
    observe([{ isIntersecting } as IntersectionObserverEntry], {} as IntersectionObserver);
  });

const play = vi.fn<() => Promise<void>>();
const onAutoplayBlocked = vi.fn();

function Card() {
  const { containerRef, videoRef } = useVideoPlayback({
    durationSeconds: 10,
    muted: false,
    volume: 1,
    hasSource: true,
    onAutoplayBlocked,
  });
  return (
    <section ref={containerRef}>
      <video data-testid="video" ref={videoRef} />
    </section>
  );
}

const rejectWith = (name: string) => Promise.reject(new DOMException("", name));

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        observe = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(play);
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  play.mockReset();
  onAutoplayBlocked.mockReset();
});

describe("useVideoPlayback autoplay fallback", () => {
  it("mutes and retries when the browser blocks sound", async () => {
    play.mockImplementationOnce(() => rejectWith("NotAllowedError")).mockResolvedValue();
    const { getByTestId } = render(<Card />);

    await setVisible(true);

    expect(onAutoplayBlocked).toHaveBeenCalledOnce();
    expect((getByTestId("video") as HTMLVideoElement).muted).toBe(true);
    expect(play).toHaveBeenCalledTimes(2);
  });

  it("leaves sound alone when a pause interrupted play()", async () => {
    play.mockImplementationOnce(() => rejectWith("AbortError"));
    const { getByTestId } = render(<Card />);

    await setVisible(true);

    expect(onAutoplayBlocked).not.toHaveBeenCalled();
    expect((getByTestId("video") as HTMLVideoElement).muted).toBe(false);
    expect(play).toHaveBeenCalledOnce();
  });

  it("does not restart a card the reader already scrolled past", async () => {
    let reject: (error: DOMException) => void = () => {};
    play.mockImplementationOnce(() => new Promise((_, r) => (reject = r)));
    render(<Card />);

    await setVisible(true);
    await setVisible(false);
    await act(async () => reject(new DOMException("", "NotAllowedError")));

    expect(onAutoplayBlocked).not.toHaveBeenCalled();
    expect(play).toHaveBeenCalledOnce();
  });
});
