import { describe, expect, it } from "vitest";

import { gridAccessChanged } from "@/lib/profile/grid-access";

const stranger = { following: false, friends: false, privateAccount: true };

describe("gridAccessChanged", () => {
  it("opens a private grid once a request is approved", () => {
    expect(gridAccessChanged(stranger, { ...stranger, following: true })).toBe(true);
  });

  it("reads the grid again when the follow becomes mutual", () => {
    const follower = { ...stranger, following: true };
    expect(gridAccessChanged(follower, { ...follower, friends: true })).toBe(true);
  });

  it("reads the grid again when the account changes its privacy", () => {
    expect(gridAccessChanged(stranger, { ...stranger, privateAccount: false })).toBe(true);
  });

  it("leaves a public grid alone when only the follow changes", () => {
    const visitor = { ...stranger, privateAccount: false };
    expect(gridAccessChanged(visitor, { ...visitor, following: true })).toBe(false);
  });

  it("leaves a private grid shut when nothing that opens it moved", () => {
    expect(gridAccessChanged(stranger, { ...stranger })).toBe(false);
  });
});
