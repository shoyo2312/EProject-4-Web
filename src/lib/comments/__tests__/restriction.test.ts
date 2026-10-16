import { describe, expect, it } from "vitest";

import { commentLockMessage } from "@/lib/comments/restriction";
import { formatDateTime } from "@/lib/format";

describe("commentLockMessage", () => {
  it("leaves the box up when nothing restricts the viewer", () => {
    expect(commentLockMessage(false, null)).toBeNull();
  });

  it("reads an account open to no one the same as the video's own switch", () => {
    const off = commentLockMessage(true, null);
    expect(off).toBe("This creator has turned off commenting");
    expect(commentLockMessage(false, "NO_ONE")).toBe(off);
    expect(commentLockMessage(false, "COMMENTS_DISABLED")).toBe(off);
  });

  it("tells a non-friend it is them, not the thread, that is shut out", () => {
    expect(commentLockMessage(false, "FRIENDS_ONLY")).toBe(
      "You cannot comment on this video",
    );
  });

  it("lets the video's switch win over whatever the account says", () => {
    expect(commentLockMessage(true, "FRIENDS_ONLY")).toBe(
      "This creator has turned off commenting",
    );
  });

  it("tells a viewer restricted for repeated violations when they can comment again", () => {
    const until = new Date(2026, 9, 14, 21, 30).getTime();
    expect(commentLockMessage(false, "COMMENTING_RESTRICTED", until)).toBe(
      `You can’t comment until ${formatDateTime(new Date(until))} because of repeated violations.`,
    );
  });

  it("still explains a restriction that came without its end", () => {
    expect(commentLockMessage(false, "COMMENTING_RESTRICTED")).toBe(
      "You can’t comment right now because of repeated violations.",
    );
  });
});
