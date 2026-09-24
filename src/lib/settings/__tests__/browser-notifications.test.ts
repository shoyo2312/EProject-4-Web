import { describe, expect, it } from "vitest";

import { shouldNotify } from "@/lib/settings/browser-notifications";

const allowed = {
  enabled: true,
  permission: "granted",
  documentHidden: true,
} as const;

describe("shouldNotify", () => {
  it("notifies when the preference, the permission and a hidden tab all agree", () => {
    expect(shouldNotify(allowed)).toBe(true);
  });

  it("stays quiet while the viewer is looking at the page", () => {
    expect(shouldNotify({ ...allowed, documentHidden: false })).toBe(false);
  });

  it("stays quiet when the switch is off, however the permission stands", () => {
    expect(shouldNotify({ ...allowed, enabled: false })).toBe(false);
  });

  it("lets a revoked permission beat a stored preference", () => {
    for (const permission of ["default", "denied", "unsupported"] as const) {
      expect(shouldNotify({ ...allowed, permission })).toBe(false);
    }
  });
});
