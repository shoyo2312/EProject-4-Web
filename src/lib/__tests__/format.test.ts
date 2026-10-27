import { describe, expect, it } from "vitest";

import {
  formatBadgeCount,
  formatBytes,
  formatCount,
  formatDateTime,
  formatDuration,
} from "@/lib/format";

describe("formatDateTime", () => {
  it("names the day and the minute, in the zone asked for", () => {
    const at = new Date("2026-10-13T14:05:00Z");

    // ICU puts a narrow no-break space before "PM"; compare on plain spaces.
    expect(formatDateTime(at, "UTC").replace(/\s/g, " ")).toBe("Oct 13, 2026, 2:05 PM");
    expect(formatDateTime(at, "Asia/Ho_Chi_Minh").replace(/\s/g, " ")).toBe(
      "Oct 13, 2026, 9:05 PM",
    );
  });
});

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

describe("formatBadgeCount", () => {
  it("caps the unread badge at 99+", () => {
    expect(formatBadgeCount(1)).toBe("1");
    expect(formatBadgeCount(99)).toBe("99");
    expect(formatBadgeCount(100)).toBe("99+");
    expect(formatBadgeCount(680)).toBe("99+");
  });
});
