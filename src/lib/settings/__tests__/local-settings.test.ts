import { describe, expect, it } from "vitest";

import {
  DEFAULT_LOCAL_SETTINGS,
  parseLocalSettings,
} from "@/lib/settings/local-settings";

describe("parseLocalSettings", () => {
  it("returns the defaults when nothing is stored", () => {
    expect(parseLocalSettings(null)).toEqual(DEFAULT_LOCAL_SETTINGS);
    expect(parseLocalSettings("")).toEqual(DEFAULT_LOCAL_SETTINGS);
  });

  it("reads every flag back", () => {
    expect(
      parseLocalSettings(
        '{"highContrast":true,"browserNotifications":true,"sideNavCollapsed":true}',
      ),
    ).toEqual({
      highContrast: true,
      browserNotifications: true,
      sideNavCollapsed: true,
    });
  });

  it("keeps the fields a partial blob does carry", () => {
    expect(parseLocalSettings('{"highContrast":true}')).toEqual({
      highContrast: true,
      browserNotifications: false,
      sideNavCollapsed: false,
    });
  });

  it("falls back per field rather than wholesale on a wrong type", () => {
    expect(
      parseLocalSettings(
        '{"highContrast":"yes","browserNotifications":true,"sideNavCollapsed":1}',
      ),
    ).toEqual({
      highContrast: false,
      browserNotifications: true,
      sideNavCollapsed: false,
    });
  });

  it("survives anything that is not an object", () => {
    for (const raw of ["not json", "null", "42", '"a string"', "[]"]) {
      expect(parseLocalSettings(raw)).toEqual(DEFAULT_LOCAL_SETTINGS);
    }
  });

  it("ignores keys it does not own", () => {
    expect(parseLocalSettings('{"highContrast":true,"muted":true}')).toEqual({
      highContrast: true,
      browserNotifications: false,
      sideNavCollapsed: false,
    });
  });
});
