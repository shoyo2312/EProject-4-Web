import { describe, expect, it } from "vitest";

import { formatBytes, formatCount, formatDuration } from "@/lib/format";

describe("formatBytes", () => {
  it("reads in MB below a gigabyte and GB above", () => {
    expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe("2.00 GB");
  });
});

describe("formatDuration", () => {
  it("pads seconds", () => {
    expect(formatDuration(65)).toBe("01:05");
  });
});

describe("formatCount", () => {
  it("abbreviates from 10k upward, TikTok style", () => {
    expect(formatCount(6834)).toBe("6834");
    expect(formatCount(20_100)).toBe("20.1K");
    expect(formatCount(1_200_000_000)).toBe("1.2B");
  });
});
