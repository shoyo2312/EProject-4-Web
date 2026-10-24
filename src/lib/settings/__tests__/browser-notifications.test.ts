import { afterEach, describe, expect, it, vi } from "vitest";

import { shouldNotify, showBrowserNotification } from "@/lib/settings/browser-notifications";
import { setBrowserNotifications } from "@/lib/settings/local-settings";
import { DEFAULT_SETTINGS } from "@/lib/settings/__tests__/user-settings-fixture";

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

describe("showBrowserNotification", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(document, "hidden");
  });

  it("does not raise a desktop notification for a switched-off type", () => {
    const raised = vi.fn();
    class FakeNotification {
      static permission = "granted";
      onclick: (() => void) | null = null;
      constructor(title: string) {
        raised(title);
      }
      close() {}
    }
    vi.stubGlobal("Notification", FakeNotification);
    Object.defineProperty(document, "hidden", { configurable: true, get: () => true });
    setBrowserNotifications(true);

    showBrowserNotification(
      { id: "n1", title: "New like", body: "", type: "LIKE" },
      DEFAULT_SETTINGS,
    );
    showBrowserNotification(
      { id: "n2", title: "New like", body: "", type: "LIKE" },
      { ...DEFAULT_SETTINGS, pushLikes: false },
    );

    expect(raised).toHaveBeenCalledTimes(1);
  });
});
