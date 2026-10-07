import { describe, expect, it } from "vitest";

import { editProfileSchemaFor } from "../schemas";

const form = { username: "minh.hung", nickname: "Minh", bio: "", avatarUrl: "" };

describe("editProfileSchemaFor", () => {
  it("lets an unchanged handle through even when it breaks today's rule", () => {
    const schema = editProfileSchemaFor("9lives");

    expect(schema.safeParse({ ...form, username: "9lives" }).success).toBe(true);
  });

  it("holds an edited handle to the rule, on the username field", () => {
    const result = editProfileSchemaFor("9lives").safeParse({ ...form, username: "Nine" });

    expect(result.success).toBe(false);
    expect(result.error?.issues[0]).toMatchObject({
      path: ["username"],
      message: "Usernames are lowercase only.",
    });
  });

  it("accepts a new handle that follows the rule", () => {
    expect(editProfileSchemaFor("9lives").safeParse(form).success).toBe(true);
  });
});
