import { describe, expect, it, vi } from "vitest";

import { awaitProfile } from "@/lib/auth/await-profile";

const fast = { delayMs: 0 };

describe("awaitProfile", () => {
  it("resolves at once when the profile already exists", async () => {
    const fetchProfile = vi.fn().mockResolvedValue({});
    await expect(awaitProfile(fetchProfile, fast)).resolves.toBe(true);
    expect(fetchProfile).toHaveBeenCalledTimes(1);
  });

  it("keeps asking until the profile shows up", async () => {
    const fetchProfile = vi
      .fn()
      .mockRejectedValueOnce(new Error("not found"))
      .mockRejectedValueOnce(new Error("not found"))
      .mockResolvedValue({});
    await expect(awaitProfile(fetchProfile, fast)).resolves.toBe(true);
    expect(fetchProfile).toHaveBeenCalledTimes(3);
  });

  it("gives up after the attempts run out instead of hanging", async () => {
    const fetchProfile = vi.fn().mockRejectedValue(new Error("not found"));
    await expect(awaitProfile(fetchProfile, { attempts: 4, delayMs: 0 })).resolves.toBe(false);
    expect(fetchProfile).toHaveBeenCalledTimes(4);
  });
});
