import { expect, it, vi } from "vitest";

const getRepostContexts = vi.fn();
vi.mock("@/lib/api/interactions", () => ({
  getRepostContexts: (ids: string[]) => getRepostContexts(ids),
}));
vi.mock("@/lib/api/users", () => ({ getFollowingIds: vi.fn() }));

import { getRepostContext, loadRepostContext } from "@/lib/repost-context";

it("asks once for a video the feed already asked about, while that answer is on its way", async () => {
  let answer!: (rows: unknown[]) => void;
  getRepostContexts.mockReturnValue(new Promise((resolve) => (answer = resolve)));

  loadRepostContext("v1"); // the feed, before its cards mount
  await Promise.resolve();
  loadRepostContext("v1"); // the card's badge, once mounted
  await Promise.resolve();

  answer([{ videoId: "v1", repostedByMe: false, reposterIds: [] }]);
  await vi.waitFor(() => expect(getRepostContext("v1")).toBeDefined());
  expect(getRepostContexts).toHaveBeenCalledTimes(1);
});
