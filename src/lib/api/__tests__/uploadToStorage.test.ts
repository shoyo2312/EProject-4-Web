import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { messageFor } from "@/lib/api/errors";
import { UPLOAD_STALL_MS, uploadToStorage } from "@/lib/api/videos";

type ProgressEvent = { lengthComputable: boolean; loaded: number; total: number };

class FakeXhr {
  static last: FakeXhr;
  status = 0;
  upload: { onprogress?: (event: ProgressEvent) => void } = {};
  onload?: () => void;
  onerror?: () => void;
  onabort?: () => void;
  onloadend?: () => void;
  aborted = false;
  constructor() {
    FakeXhr.last = this;
  }
  open() {}
  send() {}
  abort() {
    this.aborted = true;
    this.onabort?.();
    this.onloadend?.();
  }
  progress(loaded: number) {
    this.upload.onprogress?.({ lengthComputable: true, loaded, total: 100 });
  }
  finish(status: number) {
    this.status = status;
    this.onload?.();
    this.onloadend?.();
  }
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("XMLHttpRequest", FakeXhr);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const file = new File(["x"], "v.mp4", { type: "video/mp4" });

describe("uploadToStorage stall detection", () => {
  it("gives up when no bytes move for UPLOAD_STALL_MS", async () => {
    const upload = uploadToStorage("https://media.test/b", file, {});
    FakeXhr.last.progress(14);
    vi.advanceTimersByTime(UPLOAD_STALL_MS);

    const cause = await upload.catch((error: unknown) => error);
    expect(cause).toMatchObject({ code: "UPLOAD_STALLED" });
    expect(messageFor(cause)).toMatch(/stopped making progress/);
    expect(FakeXhr.last.aborted).toBe(true);
  });

  it("keeps going while progress keeps arriving", async () => {
    const upload = uploadToStorage("https://media.test/b", file, {});
    for (let loaded = 10; loaded <= 90; loaded += 10) {
      vi.advanceTimersByTime(UPLOAD_STALL_MS - 1);
      FakeXhr.last.progress(loaded);
    }
    FakeXhr.last.finish(204);

    await expect(upload).resolves.toBeUndefined();
    vi.advanceTimersByTime(UPLOAD_STALL_MS * 2);
    expect(FakeXhr.last.aborted).toBe(false);
  });
});
