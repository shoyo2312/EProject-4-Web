import { describe, expect, it } from "vitest";

import type { MessageResponse } from "@/lib/api/conversations";
import { arrivedLive } from "@/lib/chat-scroll";
import { MAX_IMAGE_BYTES, firstImage, fitImage, imageFileError } from "@/lib/chat-image";
import { messagePreview, quoteText, reactionMotion } from "@/lib/chat";

const file = (type: string, size = 1000, name = "a") => ({ type, size, name }) as File;

describe("imageFileError", () => {
  it("accepts JPEG, PNG, GIF and WebP up to the limit", () => {
    for (const type of ["image/jpeg", "image/png", "image/gif", "image/webp"]) {
      expect(imageFileError({ type, size: MAX_IMAGE_BYTES })).toBeNull();
    }
  });

  it("refuses other types, empty files and oversize files, saying the limit", () => {
    expect(imageFileError({ type: "image/svg+xml", size: 10 })).toMatch(/JPEG, PNG, GIF or WebP/);
    expect(imageFileError({ type: "image/heic", size: 10 })).toMatch(/JPEG, PNG, GIF or WebP/);
    expect(imageFileError({ type: "application/pdf", size: 10 })).toMatch(/JPEG, PNG, GIF or WebP/);
    expect(imageFileError({ type: "image/png", size: 0 })).toMatch(/couldn't be read/);
    expect(imageFileError({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })).toMatch(/5 MB/);
  });
});

describe("firstImage", () => {
  it("picks the first image among files and ignores the rest", () => {
    const files = [file("text/plain"), file("image/png", 1, "p"), file("image/jpeg", 1, "j")];
    expect(firstImage(files)?.name).toBe("p");
    expect(firstImage([file("text/plain")])).toBeNull();
    expect(firstImage(null)).toBeNull();
  });
});

describe("fitImage", () => {
  it("keeps the proportions and only ever scales down", () => {
    expect(fitImage(1000, 500, 280, 360)).toEqual({ width: 280, height: 140 });
    expect(fitImage(500, 1500, 280, 360)).toEqual({ width: 120, height: 360 });
    expect(fitImage(100, 80, 280, 360)).toEqual({ width: 100, height: 80 });
  });

  it("falls back to a sane box for a size it was not given", () => {
    expect(fitImage(0, 0, 280, 360)).toEqual({ width: 280, height: 210 });
  });
});

describe("reactionMotion", () => {
  const group = (emoji: string, count: number) => ({ emoji, count, mine: false });

  it("pops a new emoji, bumps a higher count and leaves the rest still", () => {
    const before = new Map([
      ["👍", 1],
      ["😂", 2],
      ["😮", 1],
    ]);
    const after = [group("👍", 2), group("😂", 2), group("😮", 1), group("❤️", 1)];
    expect([...reactionMotion(before, after)]).toEqual([
      ["👍", "bump"],
      ["❤️", "pop"],
    ]);
  });

  it("does not move for fewer reactions or none changed", () => {
    expect(reactionMotion(new Map([["👍", 2]]), [group("👍", 1)]).size).toBe(0);
    expect(reactionMotion(new Map([["👍", 2]]), [group("👍", 2)]).size).toBe(0);
  });
});

describe("arrivedLive", () => {
  const m = (id: string) => ({ id }) as MessageResponse;

  it("keeps only the appended messages that arrived live", () => {
    expect(arrivedLive([m("1"), m("2"), m("3")], new Set(["2"])).map((x) => x.id)).toEqual(["2"]);
    expect(arrivedLive([m("1")], new Set())).toEqual([]);
  });
});

describe("photo wording", () => {
  it("previews, quotes and notifies a photo without leaking its caption into the preview", () => {
    expect(messagePreview({ lastMessageContent: null, lastMessageType: "IMAGE", lastMessageSenderId: "1" }, "1")).toBe("You sent a photo");
    expect(messagePreview({ lastMessageContent: null, lastMessageType: "IMAGE", lastMessageSenderId: "2" }, "1")).toBe("Sent a photo");
    expect(quoteText("hello", "IMAGE")).toBe("Photo · hello");
    expect(quoteText(null, "IMAGE")).toBe("Photo");
  });
});
