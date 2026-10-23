import { afterEach, describe, expect, it, vi } from "vitest";

import type { StoryResponse, StoryRing } from "@/lib/api/types";

import { createRingStore, ringStateOf } from "../ring-store";

afterEach(() => {
  vi.useRealTimers();
});

/** Lets a request's whole promise chain, from `fetchRings` to the listeners, run to its end. */
const settled = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function setup(answer: (userIds: string[]) => Promise<StoryRing[]> = async () => []) {
  const fetchRings = vi.fn(answer);
  const scheduled: Array<() => void> = [];
  let time = 0;
  const store = createRingStore({
    fetchRings,
    ttlMs: 1000,
    now: () => time,
    schedule: (run) => {
      scheduled.push(run);
    },
  });
  return {
    store,
    fetchRings,
    advance: (ms: number) => {
      time += ms;
    },
    /** One tick of the store's clock: the flush it scheduled runs, then the answers land. */
    tick: async () => {
      scheduled.splice(0).forEach((run) => run());
      await settled();
    },
  };
}

describe("createRingStore", () => {
  it("sends the ids subscribed in one tick as one request", async () => {
    const { store, fetchRings, tick } = setup();

    store.subscribe("1", vi.fn());
    store.subscribe("2", vi.fn());
    store.subscribe("1", vi.fn());
    expect(fetchRings).not.toHaveBeenCalled();
    await tick();

    expect(fetchRings.mock.calls).toEqual([[["1", "2"]]]);
  });

  it("splits more than 100 ids into chunks", async () => {
    const { store, fetchRings, tick } = setup();
    const ids = Array.from({ length: 250 }, (_, i) => String(i + 1));

    ids.forEach((id) => store.subscribe(id, vi.fn()));
    await tick();

    expect(fetchRings.mock.calls.map(([chunk]) => chunk.length)).toEqual([100, 100, 50]);
    expect(fetchRings.mock.calls.flatMap(([chunk]) => chunk)).toEqual(ids);
  });

  it("an id missing from the answer has no ring", async () => {
    const { store, tick } = setup(async () => [{ userId: "1", hasUnseen: true }]);
    const first = vi.fn();
    const second = vi.fn();

    store.subscribe("1", first);
    store.subscribe("2", second);
    expect(store.get("1")).toBeUndefined();
    await tick();

    expect(store.get("1")).toBe("unseen");
    expect(store.get("2")).toBe("none");
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("shows a seen ring when nothing the viewer may watch is new", async () => {
    const { store, tick } = setup(async () => [{ userId: "1", hasUnseen: false }]);

    store.subscribe("1", vi.fn());
    await tick();

    expect(store.get("1")).toBe("seen");
  });

  it("does not ask again until the answer is stale", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => [
      { userId: "1", hasUnseen: true },
    ]);
    store.subscribe("1", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    advance(999);
    store.subscribe("1", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    advance(2);
    store.subscribe("1", vi.fn());
    await tick();
    expect(fetchRings.mock.calls).toEqual([[["1"]], [["1"]]]);
  });

  it("does not ask again while its request is still on the way", async () => {
    const { store, fetchRings, tick } = setup();
    const onTheWay = deferred<StoryRing[]>();
    fetchRings.mockReturnValueOnce(onTheWay.promise);
    const first = vi.fn();
    const second = vi.fn();
    store.subscribe("1", first);
    await tick();

    store.subscribe("1", second);
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    onTheWay.resolve([{ userId: "1", hasUnseen: true }]);
    await settled();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("does not wake listeners when a refresh finds the same state", async () => {
    const { store, tick, advance } = setup(async () => [{ userId: "1", hasUnseen: true }]);
    const listener = vi.fn();
    store.subscribe("1", listener);
    await tick();

    advance(1001);
    store.subscribe("1", vi.fn());
    await tick();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("a failed request shows no ring, and is asked again only after the answer would be stale", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => {
      throw new Error("gateway down");
    });
    const listener = vi.fn();
    store.subscribe("1", listener);
    await tick();

    expect(store.get("1")).toBe("none");
    expect(listener).toHaveBeenCalledTimes(1);

    store.subscribe("1", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    advance(1001);
    store.subscribe("1", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(2);
  });

  it("an answer that is not a list counts as a failed request", async () => {
    const { store, tick } = setup(async () => null as unknown as StoryRing[]);

    store.subscribe("1", vi.fn());
    await tick();

    expect(store.get("1")).toBe("none");
  });

  it("set turns an owner grey without asking", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => [
      { userId: "9", hasUnseen: true },
    ]);
    const listener = vi.fn();
    store.subscribe("9", listener);
    await tick();
    listener.mockClear();

    advance(900);
    store.set("9", "seen");

    expect(store.get("9")).toBe("seen");
    expect(listener).toHaveBeenCalledTimes(1);

    // The server's answer is 1800 ms old by now, the local one 900 ms: it counts as fresh.
    advance(900);
    store.subscribe("9", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);
  });

  it("set spares the request an id was still waiting to send", async () => {
    const { store, fetchRings, tick } = setup();

    store.subscribe("9", vi.fn());
    store.set("9", "none");
    await tick();

    expect(fetchRings).not.toHaveBeenCalled();
    expect(store.get("9")).toBe("none");
  });

  it("keeps what set said when an older answer arrives late", async () => {
    const { store, fetchRings, tick } = setup();
    const late = deferred<StoryRing[]>();
    fetchRings.mockReturnValueOnce(late.promise);
    const listener = vi.fn();
    store.subscribe("9", listener);
    await tick();

    store.set("9", "seen");
    late.resolve([{ userId: "9", hasUnseen: true }]);
    await settled();

    expect(store.get("9")).toBe("seen");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("invalidate asks again for a subscribed id", async () => {
    const { store, fetchRings, tick } = setup();
    fetchRings.mockResolvedValueOnce([{ userId: "9", hasUnseen: false }]);
    const listener = vi.fn();
    store.subscribe("9", listener);
    await tick();
    expect(store.get("9")).toBe("seen");
    listener.mockClear();

    fetchRings.mockResolvedValueOnce([{ userId: "9", hasUnseen: true }]);
    store.invalidate("9");
    expect(store.get("9")).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
    await tick();

    expect(fetchRings.mock.calls).toEqual([[["9"]], [["9"]]]);
    expect(store.get("9")).toBe("unseen");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("invalidate leaves an id nobody is subscribed to for its next subscriber", async () => {
    const { store, fetchRings, tick } = setup();
    const unsubscribe = store.subscribe("9", vi.fn());
    await tick();
    unsubscribe();

    store.invalidate("9");
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);
    expect(store.get("9")).toBeUndefined();

    store.subscribe("9", vi.fn());
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(2);
  });

  it("ignores an answer to an id that was invalidated meanwhile, and asks again", async () => {
    const { store, fetchRings, tick } = setup();
    const older = deferred<StoryRing[]>();
    fetchRings.mockReturnValueOnce(older.promise);
    fetchRings.mockResolvedValueOnce([{ userId: "9", hasUnseen: true }]);
    store.subscribe("9", vi.fn());
    await tick();

    store.invalidate("9");
    older.resolve([{ userId: "9", hasUnseen: false }]);
    await settled();
    expect(store.get("9")).toBeUndefined();

    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(2);
    expect(store.get("9")).toBe("unseen");
  });

  it("stops calling a listener once it unsubscribed, and only that one", async () => {
    const { store, tick } = setup(async () => [{ userId: "1", hasUnseen: true }]);
    const leaving = vi.fn();
    const staying = vi.fn();
    const unsubscribe = store.subscribe("1", leaving);
    store.subscribe("1", staying);
    await tick();
    leaving.mockClear();
    staying.mockClear();

    unsubscribe();
    store.set("1", "seen");

    expect(leaving).not.toHaveBeenCalled();
    expect(staying).toHaveBeenCalledTimes(1);
  });

  it("uses the real clock by default: a 50 ms tick and a one-minute lifetime", async () => {
    vi.useFakeTimers();
    const fetchRings = vi.fn(async (): Promise<StoryRing[]> => []);
    const store = createRingStore({ fetchRings });
    store.subscribe("1", vi.fn());

    await vi.advanceTimersByTimeAsync(49);
    expect(fetchRings).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(fetchRings).toHaveBeenCalledTimes(1);

    // The answer landed at 50 ms: 59.85 s later it still counts, 60.05 s later it does not.
    await vi.advanceTimersByTimeAsync(59_850);
    store.subscribe("1", vi.fn());
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchRings).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(150);
    store.subscribe("1", vi.fn());
    await vi.advanceTimersByTimeAsync(50);
    expect(fetchRings).toHaveBeenCalledTimes(2);
  });
});

describe("createRingStore, refresh", () => {
  it("asks again, in one request, for the ids still shown whose answer is stale", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => [
      { userId: "1", hasUnseen: true },
    ]);
    store.subscribe("1", vi.fn());
    store.subscribe("2", vi.fn());
    await tick();

    // Answers count until they are older than the lifetime, as they do for a new subscriber.
    advance(1000);
    store.refresh();
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    advance(1);
    store.refresh();
    await tick();
    expect(fetchRings.mock.calls).toEqual([[["1", "2"]], [["1", "2"]]]);
  });

  it("leaves alone an id that is fresh, one nobody shows any more, and one already on its way", async () => {
    const { store, fetchRings, tick, advance } = setup();
    store.subscribe("1", vi.fn());
    const leave = store.subscribe("2", vi.fn());
    store.subscribe("3", vi.fn());
    await tick();
    advance(1001);

    store.set("1", "seen");
    leave();
    const onTheWay = deferred<StoryRing[]>();
    fetchRings.mockReturnValueOnce(onTheWay.promise);
    store.subscribe("4", vi.fn());
    await tick();

    store.refresh();
    await tick();

    // Only "3": its answer is stale and an avatar still shows it.
    expect(fetchRings.mock.calls).toEqual([[["1", "2", "3"]], [["4"]], [["3"]]]);
    onTheWay.resolve([]);
  });

  it("asks again for an id whose request failed, once that answer is stale", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => {
      throw new Error("gateway down");
    });
    store.subscribe("1", vi.fn());
    await tick();
    expect(store.get("1")).toBe("none");

    store.refresh();
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(1);

    advance(1001);
    fetchRings.mockResolvedValueOnce([{ userId: "1", hasUnseen: true }]);
    store.refresh();
    await tick();

    expect(fetchRings).toHaveBeenCalledTimes(2);
    expect(store.get("1")).toBe("unseen");
  });

  it("keeps the ring it showed when a refresh fails, and asks again once that is stale", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => [
      { userId: "1", hasUnseen: true },
    ]);
    const listener = vi.fn();
    store.subscribe("1", listener);
    await tick();
    expect(listener).toHaveBeenCalledTimes(1);

    advance(1001);
    fetchRings.mockRejectedValueOnce(new Error("gateway down"));
    store.refresh();
    await tick();

    expect(store.get("1")).toBe("unseen");
    expect(listener).toHaveBeenCalledTimes(1);

    store.refresh();
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(2);

    advance(1001);
    store.refresh();
    await tick();
    expect(fetchRings).toHaveBeenCalledTimes(3);
  });

  it("keeps what set said when the answer to a refresh arrives late", async () => {
    const { store, fetchRings, tick, advance } = setup(async () => [
      { userId: "9", hasUnseen: true },
    ]);
    store.subscribe("9", vi.fn());
    await tick();
    advance(1001);
    const late = deferred<StoryRing[]>();
    fetchRings.mockReturnValueOnce(late.promise);
    store.refresh();
    await tick();

    store.set("9", "seen");
    late.resolve([{ userId: "9", hasUnseen: true }]);
    await settled();

    expect(store.get("9")).toBe("seen");
  });
});

function story(overrides: Partial<StoryResponse> = {}): StoryResponse {
  return {
    id: "s",
    userId: "1",
    mediaUrl: "https://media/s",
    mediaType: "IMAGE",
    caption: null,
    visibility: "PUBLIC",
    status: null,
    durationSeconds: null,
    viewCount: null,
    viewedByMe: false,
    createdAt: "2026-10-20T10:00:00Z",
    expiresAt: "2026-10-21T10:00:00Z",
    ...overrides,
  };
}

describe("ringStateOf", () => {
  it("is none when there is nothing to watch", () => {
    expect(ringStateOf([], true)).toBe("none");
    expect(ringStateOf([], false)).toBe("none");
  });

  it("is unseen for the owner while one of their stories is live", () => {
    expect(ringStateOf([story({ status: "ACTIVE" })], true)).toBe("unseen");
    // Having watched their own story changes nothing: ACTIVE is what keeps the ring red.
    expect(
      ringStateOf([story({ status: "HELD" }), story({ status: "ACTIVE", viewedByMe: true })], true),
    ).toBe("unseen");
  });

  it("is seen for the owner when no story has passed moderation yet", () => {
    expect(
      ringStateOf([story({ status: "PENDING_MODERATION" }), story({ status: "HELD" })], true),
    ).toBe("seen");
  });

  it("is unseen for another account while one of its stories is unviewed", () => {
    expect(ringStateOf([story({ viewedByMe: true }), story()], false)).toBe("unseen");
  });

  it("is seen for another account once every story was viewed", () => {
    expect(ringStateOf([story({ viewedByMe: true }), story({ viewedByMe: true })], false)).toBe(
      "seen",
    );
  });
});
