import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TYPING_HEARTBEAT_MS, TYPING_IDLE_MS } from "@/lib/typing";

const { publish, socket } = vi.hoisted(() => ({
  publish: vi.fn<(destination: string, body: unknown) => boolean>(),
  socket: { onDisconnect: null as (() => void) | null },
}));

vi.mock("@/lib/realtime/stompClient", () => ({
  publishStomp: (destination: string, body: unknown) => publish(destination, body),
  onStompDisconnect: (listener: () => void) => {
    socket.onDisconnect = listener;
    return () => {
      socket.onDisconnect = null;
    };
  },
}));

import { useTypingSender } from "@/hooks/use-typing-sender";

const sent = () => publish.mock.calls.map((c) => (c[1] as { typing: boolean }).typing);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "Date"] });
  publish.mockReset().mockReturnValue(true);
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useTypingSender", () => {
  it("says nothing until the person does something", () => {
    renderHook(() => useTypingSender("c1", true));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(publish).not.toHaveBeenCalled();
  });

  it("starts on the first input, to this conversation's own destination, with nothing but the flag", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));
    expect(publish).toHaveBeenCalledWith("/app/chat.typing/c1", { typing: true });
    expect(Object.keys(publish.mock.calls[0][1] as object)).toEqual(["typing"]);
  });

  it("is a heartbeat while input goes on, not a frame per keystroke", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    for (let i = 0; i < 20; i += 1) {
      act(() => result.current.input(true));
      act(() => void vi.advanceTimersByTime(300));
    }
    // 6 seconds of typing: the first frame and a renewal about every 2.5s.
    expect(sent().every(Boolean)).toBe(true);
    expect(publish.mock.calls.length).toBeGreaterThanOrEqual(2);
    expect(publish.mock.calls.length).toBeLessThanOrEqual(Math.ceil(6_000 / TYPING_HEARTBEAT_MS) + 1);
  });

  it("stops by itself a few seconds after the last keystroke", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));

    act(() => void vi.advanceTimersByTime(TYPING_IDLE_MS - 100));
    expect(sent()).toEqual([true]);

    act(() => void vi.advanceTimersByTime(200));
    expect(sent()).toEqual([true, false]);
  });

  it("stops at once when the box is emptied or the message is sent", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));
    act(() => result.current.input(false));
    expect(sent()).toEqual([true, false]);

    // Stopping again says nothing more.
    act(() => result.current.stop());
    expect(sent()).toEqual([true, false]);
  });

  it("stops when the conversation changes or the thread goes away", () => {
    const view = renderHook(({ id }) => useTypingSender(id, true), { initialProps: { id: "c1" } });
    act(() => view.result.current.input(true));

    view.rerender({ id: "c2" });
    expect(publish).toHaveBeenLastCalledWith("/app/chat.typing/c1", { typing: false });

    act(() => view.result.current.input(true));
    view.unmount();
    expect(publish).toHaveBeenLastCalledWith("/app/chat.typing/c2", { typing: false });
  });

  it("stops when the tab is hidden or the window loses focus", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));
    act(() => void window.dispatchEvent(new Event("blur")));
    expect(sent()).toEqual([true, false]);

    act(() => result.current.input(true));
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden");
    act(() => void document.dispatchEvent(new Event("visibilitychange")));
    expect(sent()).toEqual([true, false, true, false]);
  });

  it("stops when it is no longer allowed — blocked, locked — and never starts while it is not", () => {
    const view = renderHook(({ on }) => useTypingSender("c1", on), { initialProps: { on: true } });
    act(() => view.result.current.input(true));
    view.rerender({ on: false });
    expect(sent()).toEqual([true, false]);

    act(() => view.result.current.input(true));
    expect(sent()).toEqual([true, false]);
  });

  it("a socket that is down sends nothing and is not remembered as typing", () => {
    publish.mockReturnValue(false);
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));

    publish.mockReturnValue(true);
    act(() => result.current.input(true));
    // The first frame never went out, so the next input is a start, not a renewal.
    expect(sent()).toEqual([true, true]);
  });

  it("after the connection drops nothing is replayed: it starts again only on the next input", () => {
    const { result } = renderHook(() => useTypingSender("c1", true));
    act(() => result.current.input(true));
    publish.mockClear();

    act(() => socket.onDisconnect?.());
    act(() => void vi.advanceTimersByTime(60_000));
    expect(publish).not.toHaveBeenCalled();

    act(() => result.current.input(true));
    expect(sent()).toEqual([true]);
  });
});
