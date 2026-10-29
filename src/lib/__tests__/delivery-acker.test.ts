import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MessageResponse, Receipt } from "@/lib/api/conversations";
import { ACK_BATCH, ACK_DELAY_MS, ACK_RETRIES, ACK_RETRY_MS, DeliveryAcker } from "../delivery-acker";

const ME = "1";
const at = (n: number) => new Date(Date.UTC(2026, 9, 28, 8, 0, n)).toISOString();
const msg = (n: number, senderId = "2") => ({ id: String(100 + n), sentAt: at(n), senderId }) as Pick<MessageResponse, "id" | "sentAt" | "senderId">;
const receipt = (n: number | null): Receipt => ({
  userId: ME,
  delivered: n === null ? null : { messageId: String(100 + n), sentAt: at(n), at: at(60) },
  read: null,
});

function setup(answer: (ids: string[]) => Receipt | Promise<Receipt> = (ids) => receipt(Number(ids[ids.length - 1]) - 100)) {
  const acknowledge = vi.fn(async (...[, ids]: [string, string[]]) => answer(ids));
  const fetchNewest = vi.fn(async (...[]: [string]): Promise<MessageResponse[]> => []);
  const acker = new DeliveryAcker({ me: ME, acknowledge, fetchNewest });
  return { acker, acknowledge, fetchNewest };
}

const tick = (ms: number) => act(ms);
async function act(ms: number) {
  await vi.advanceTimersByTimeAsync(ms);
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("DeliveryAcker", () => {
  it("names the messages it holds, once the burst is quiet — a burst is one request", async () => {
    const { acker, acknowledge } = setup();
    for (let n = 1; n <= 5; n += 1) {
      acker.hold("c1", [msg(n)]);
      await tick(100);
    }
    expect(acknowledge).not.toHaveBeenCalled();

    await tick(ACK_DELAY_MS);

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(acknowledge).toHaveBeenCalledWith("c1", ["101", "102", "103", "104", "105"]);
  });

  it("never names the viewer's own messages", async () => {
    const { acker, acknowledge } = setup();
    acker.hold("c1", [msg(1, ME)]);
    await tick(1_000);
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("sends the same message once: a duplicate frame adds nothing, and what the server confirmed is dropped", async () => {
    const { acker, acknowledge } = setup();
    acker.hold("c1", [msg(1)]);
    acker.hold("c1", [msg(1)]);
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge).toHaveBeenCalledTimes(1);

    acker.hold("c1", [msg(1)]);
    await tick(1_000);
    expect(acknowledge).toHaveBeenCalledTimes(1);

    acker.hold("c1", [msg(2)]);
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge).toHaveBeenLastCalledWith("c1", ["102"]);
  });

  it("keeps conversations apart", async () => {
    const { acker, acknowledge } = setup();
    acker.hold("c1", [msg(1)]);
    acker.hold("c2", [msg(2)]);
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge.mock.calls).toEqual(expect.arrayContaining([["c1", ["101"]], ["c2", ["102"]]]));
  });

  it("when the answer stops short, a message in between never arrived: it reads the newest page and names the run again", async () => {
    let calls = 0;
    const { acker, acknowledge, fetchNewest } = setup(() => (++calls === 1 ? receipt(1) : receipt(3)));
    fetchNewest.mockResolvedValue([msg(2), msg(3)] as MessageResponse[]);

    acker.hold("c1", [msg(1), msg(3)]); // 102 was lost on the way
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge).toHaveBeenNthCalledWith(1, "c1", ["101", "103"]);
    expect(fetchNewest).toHaveBeenCalledWith("c1");

    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge).toHaveBeenNthCalledWith(2, "c1", ["102", "103"]);
  });

  it("does not look for a gap for ever", async () => {
    const { acker, acknowledge, fetchNewest } = setup(() => receipt(1));
    acker.hold("c1", [msg(1), msg(3)]);
    for (let i = 0; i < 10; i += 1) await tick(ACK_DELAY_MS + 10);
    expect(fetchNewest.mock.calls.length).toBeLessThanOrEqual(2);
    expect(acknowledge.mock.calls.length).toBeLessThanOrEqual(4);
  });

  it("retries a failure after a wait that grows, with the same ids, and gives up after a few", async () => {
    const { acker, acknowledge } = setup(() => {
      throw new Error("offline");
    });
    acker.hold("c1", [msg(1)]);
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge).toHaveBeenCalledTimes(1);

    await tick(ACK_RETRY_MS);
    expect(acknowledge).toHaveBeenCalledTimes(2);
    await tick(ACK_RETRY_MS);
    expect(acknowledge).toHaveBeenCalledTimes(2); // the second wait is longer
    await tick(ACK_RETRY_MS);
    expect(acknowledge).toHaveBeenCalledTimes(3);
    for (let i = 0; i < 20; i += 1) await tick(ACK_RETRY_MS * 2 ** ACK_RETRIES);
    expect(acknowledge.mock.calls.length).toBe(1 + ACK_RETRIES);
    expect(acknowledge.mock.calls.every((c) => c[1].join() === "101")).toBe(true);
  });

  it("sends at most one batch at a time, oldest first", async () => {
    const { acker, acknowledge } = setup((ids) => receipt(Number(ids[ids.length - 1]) - 100));
    acker.hold("c1", Array.from({ length: ACK_BATCH + 20 }, (_, i) => msg(i + 1)));
    await tick(ACK_DELAY_MS + 10);
    expect(acknowledge.mock.calls[0][1]).toHaveLength(ACK_BATCH);
    expect(acknowledge.mock.calls[0][1][0]).toBe("101");
  });

  it("catches up a conversation that has unread it may not hold: reads its newest page, holds it, acknowledges it", async () => {
    const { acker, acknowledge, fetchNewest } = setup();
    fetchNewest.mockResolvedValue([msg(2), msg(1), msg(0, ME)] as MessageResponse[]);

    await acker.catchUp("c1", at(2));
    await tick(ACK_DELAY_MS + 10);

    expect(fetchNewest).toHaveBeenCalledTimes(1);
    expect(acknowledge).toHaveBeenCalledWith("c1", ["101", "102"]);
  });

  it("does not catch up what the server already confirmed", async () => {
    const { acker, fetchNewest } = setup();
    acker.hold("c1", [msg(2)]);
    await tick(ACK_DELAY_MS + 10);

    await acker.catchUp("c1", at(2));

    expect(fetchNewest).not.toHaveBeenCalled();
  });

  it("does not run two catch-ups of one conversation at once", async () => {
    const { acker, fetchNewest } = setup();
    let release: () => void = () => {};
    fetchNewest.mockImplementation(() => new Promise((resolve) => (release = () => resolve([]))));
    const first = acker.catchUp("c1", at(5));
    void acker.catchUp("c1", at(5));
    expect(fetchNewest).toHaveBeenCalledTimes(1);
    release();
    await first;
  });

  it("after dispose — signing out or switching account — nothing more is sent and no answer is applied", async () => {
    const { acker, acknowledge, fetchNewest } = setup();
    acker.hold("c1", [msg(1)]);
    acker.dispose();
    await tick(10_000);
    expect(acknowledge).not.toHaveBeenCalled();

    acker.hold("c1", [msg(2)]);
    await acker.catchUp("c1", at(2));
    await tick(10_000);
    expect(acknowledge).not.toHaveBeenCalled();
    expect(fetchNewest).not.toHaveBeenCalled();
  });

  it("an answer that arrives after dispose neither schedules a retry nor a gap fill", async () => {
    let resolve: (value: Receipt) => void = () => {};
    const { acker, acknowledge, fetchNewest } = setup(() => new Promise<Receipt>((r) => (resolve = r)));
    acker.hold("c1", [msg(1), msg(3)]);
    await tick(ACK_DELAY_MS + 10);
    acker.dispose();

    resolve(receipt(1));
    await tick(10_000);

    expect(acknowledge).toHaveBeenCalledTimes(1);
    expect(fetchNewest).not.toHaveBeenCalled();
  });
});
