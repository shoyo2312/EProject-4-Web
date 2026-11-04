import { afterEach, describe, expect, it, vi } from "vitest";

import { downloadFile } from "@/lib/download";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("downloadFile", () => {
  it("rejects when the file cannot be fetched, instead of opening a tab the browser would block", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const open = vi.spyOn(window, "open").mockImplementation(() => null);

    await expect(downloadFile("https://media.example/v.mp4", "v.mp4")).rejects.toThrow();
    expect(open).not.toHaveBeenCalled();
  });

  it("rejects on a non-2xx answer", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 403 }));
    vi.spyOn(window, "open").mockImplementation(() => null);

    await expect(downloadFile("https://media.example/v.mp4", "v.mp4")).rejects.toThrow("HTTP 403");
  });
});
