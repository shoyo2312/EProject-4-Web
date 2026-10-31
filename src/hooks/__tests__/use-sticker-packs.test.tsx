import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { StickerPack } from "@/lib/api/conversations";

const { listStickerPacks } = vi.hoisted(() => ({ listStickerPacks: vi.fn<() => Promise<StickerPack[]>>() }));

vi.mock("@/lib/api/conversations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/conversations")>()),
  listStickerPacks: () => listStickerPacks(),
}));

import { resetStickerPacksCache, useStickerPacks } from "@/hooks/use-sticker-packs";

const pack: StickerPack = {
  packId: "fluent-3d",
  name: "Fluent 3D",
  stickers: [{ stickerId: "fire", name: "Fire", url: "http://x/fire.png", width: 256, height: 256 }],
};
const flush = () => act(async () => {});

beforeEach(() => {
  listStickerPacks.mockReset();
  resetStickerPacksCache();
});
afterEach(cleanup);

describe("useStickerPacks", () => {
  it("does not fetch until the picker asks", async () => {
    renderHook(() => useStickerPacks(false));
    await flush();
    expect(listStickerPacks).not.toHaveBeenCalled();
  });

  it("fetches once and shares the answer between pickers", async () => {
    listStickerPacks.mockResolvedValue([pack]);
    const first = renderHook(() => useStickerPacks(true));
    const second = renderHook(() => useStickerPacks(true));
    await flush();

    expect(listStickerPacks).toHaveBeenCalledTimes(1);
    expect(first.result.current.status).toBe("ready");
    expect(second.result.current.status).toBe("ready");
  });

  it("reports a failure and tries again on request, without remembering the failure", async () => {
    listStickerPacks.mockRejectedValueOnce(new Error("down")).mockResolvedValueOnce([pack]);
    const { result } = renderHook(() => useStickerPacks(true));
    await flush();
    expect(result.current.status).toBe("error");

    act(() => result.current.reload());
    await flush();

    expect(result.current.status).toBe("ready");
    expect(listStickerPacks).toHaveBeenCalledTimes(2);
  });
});
