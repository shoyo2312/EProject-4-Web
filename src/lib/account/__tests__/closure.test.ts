import { describe, expect, it } from "vitest";

import { closureProofFor, linkedProviders } from "@/lib/account/closure";

const socialOnly = { hasPassword: false, email: null, emailVerified: false, providers: [] };

describe("closureProofFor", () => {
  it("asks for the password when the account has one", () => {
    expect(
      closureProofFor({ ...socialOnly, hasPassword: true, email: "a@b.co", emailVerified: true }),
    ).toEqual({ kind: "password" });
  });

  it("mails a code to a verified address when there is no password", () => {
    expect(closureProofFor({ ...socialOnly, email: "a@b.co", emailVerified: true })).toEqual({
      kind: "code",
      email: "a@b.co",
    });
  });

  it("does not mail an address nobody has proven", () => {
    expect(
      closureProofFor({ ...socialOnly, email: "a@b.co", emailVerified: false, providers: ["facebook"] }),
    ).toEqual({ kind: "provider", provider: "facebook" });
  });

  it("falls back to the first linked provider", () => {
    expect(closureProofFor({ ...socialOnly, providers: ["google", "facebook"] })).toEqual({
      kind: "provider",
      provider: "google",
    });
  });

  it("has nothing to offer an account with no way in but its session", () => {
    expect(closureProofFor(socialOnly)).toEqual({ kind: "none" });
  });
});

describe("linkedProviders", () => {
  it("reads auth-service's names and drops the ones without a button", () => {
    expect(linkedProviders(["FACEBOOK", "APPLE", "GOOGLE", "FACEBOOK"])).toEqual(["facebook", "google"]);
  });

  it("reads a gateway too old to send the field as none", () => {
    expect(linkedProviders(undefined)).toEqual([]);
  });
});
