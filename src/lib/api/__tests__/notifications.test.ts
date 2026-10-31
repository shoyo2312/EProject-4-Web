import { describe, expect, it } from "vitest";

import { referencesUser } from "@/lib/api/notifications";

describe("referencesUser", () => {
  // A STORY entry's referenceId is its owner. Without this the inbox would look that id up as a video.
  it.each(["NEW_FOLLOWER", "FOLLOW_REQUEST", "FOLLOW_REQUEST_ACCEPTED", "STORY"] as const)(
    "is true for %s",
    (type) => expect(referencesUser(type)).toBe(true),
  );

  it.each(["LIKE", "COMMENT", "COMMENT_LIKE", "SHARE", "SYSTEM"] as const)(
    "is false for %s",
    (type) => expect(referencesUser(type)).toBe(false),
  );
});
