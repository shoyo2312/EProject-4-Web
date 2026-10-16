import { describe, expect, it } from "vitest";

import { changedProfileFields } from "../changed-fields";

describe("changedProfileFields", () => {
  const current = { username: "alice", nickname: "Alice", bio: "Hello" };

  it("is empty for an untouched draft", () => {
    expect(changedProfileFields(current, current)).toEqual({});
  });

  it("returns only the fields that changed, trimmed", () => {
    expect(
      changedProfileFields(
        { username: "alice", nickname: "  Alicia ", bio: "Hello" },
        current,
      ),
    ).toEqual({ nickname: "Alicia" });
  });

  it("does not count a space the draft gained as a change", () => {
    expect(
      changedProfileFields(
        { username: "alice ", nickname: "Alice ", bio: " Hello" },
        current,
      ),
    ).toEqual({});
  });

  it("does not count a stored name's stray space as a change", () => {
    const stored = { username: "alice", nickname: "Alice ", bio: "Hello\n" };

    expect(
      changedProfileFields(
        { username: "alice", nickname: "Alice", bio: "Hello" },
        stored,
      ),
    ).toEqual({});
    expect(
      changedProfileFields(
        { username: "alice", nickname: "Alice", bio: "Bye" },
        stored,
      ),
    ).toEqual({ bio: "Bye" });
  });

  it("reports a cleared bio as an empty string, which deletes it", () => {
    expect(
      changedProfileFields({ ...current, bio: "   " }, current),
    ).toEqual({ bio: "" });
  });
});
