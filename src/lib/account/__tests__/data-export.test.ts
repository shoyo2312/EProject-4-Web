import { describe, expect, it } from "vitest";

import {
  DATA_EXPORT_CATEGORIES,
  hasProcessingExport,
  pastStatusLabel,
  requestScopeLabel,
  requestedOnLabel,
  splitDataExports,
} from "@/lib/account/data-export";
import type { DataExportResponse } from "@/lib/api/data-export";

function request(id: string, status: DataExportResponse["status"]): DataExportResponse {
  return {
    id,
    format: "TXT",
    categories: ["POSTS"],
    status,
    requestedAt: "2026-10-18T12:00:00Z",
    readyAt: null,
    expiresAt: null,
    sizeBytes: null,
  };
}

describe("splitDataExports", () => {
  it("keeps processing and downloadable requests active, in order", () => {
    const { active, past } = splitDataExports([
      request("5", "READY"),
      request("4", "EXPIRED"),
      request("3", "PROCESSING"),
      request("2", "CANCELED"),
      request("1", "FAILED"),
    ]);
    expect(active.map((r) => r.id)).toEqual(["5", "3"]);
    expect(past.map((r) => r.id)).toEqual(["4", "2", "1"]);
  });
});

describe("hasProcessingExport", () => {
  it("is true only while one is still being made", () => {
    expect(hasProcessingExport([request("1", "READY")])).toBe(false);
    expect(hasProcessingExport([request("1", "READY"), request("2", "PROCESSING")])).toBe(true);
  });
});

describe("requestedOnLabel", () => {
  it("reads like the live card", () => {
    expect(requestedOnLabel("2026-10-18T12:00:00Z", "en-US")).toBe("Requested on Oct 18, 2026");
  });
});

describe("requestScopeLabel", () => {
  it("says all data only when every category was asked for", () => {
    const all = DATA_EXPORT_CATEGORIES.map(({ value }) => value);
    expect(requestScopeLabel({ categories: all, format: "JSON" })).toBe(
      "All available data from Nowa · JSON format",
    );
    expect(requestScopeLabel({ categories: ["POSTS"], format: "TXT" })).toBe(
      "Selected data from Nowa · TXT format",
    );
  });
});

describe("pastStatusLabel", () => {
  it("names how a request ended", () => {
    expect(pastStatusLabel("CANCELED")).toBe("Canceled");
    expect(pastStatusLabel("FAILED")).toBe("Failed");
    expect(pastStatusLabel("EXPIRED")).toBe("Expired");
  });
});
