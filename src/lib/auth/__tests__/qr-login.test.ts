import { describe, expect, it } from "vitest";

import type { QrLoginStatusResponse } from "@/lib/api/types";
import { hasLapsed, nextQrView, type QrView } from "@/lib/auth/qr-login";

const code = {
  qrId: "AbCdEfGhIjKlMnOpQrSt12",
  pollToken: "secret",
  qrContent: "nowa://qr-login?id=AbCdEfGhIjKlMnOpQrSt12",
  expiresAt: "2026-11-05T10:02:00Z",
};
const showing: QrView = { phase: "showing", code, scannedBy: null };

function answer(patch: Partial<QrLoginStatusResponse>): QrLoginStatusResponse {
  return { status: "PENDING", username: null, tokens: null, ...patch };
}

describe("nextQrView", () => {
  it("keeps showing the same code while nobody has scanned it", () => {
    expect(nextQrView(showing, answer({}))).toBe(showing);
  });

  it("names the account that scanned it", () => {
    expect(nextQrView(showing, answer({ status: "SCANNED", username: "johndoe" }))).toEqual({
      ...showing,
      scannedBy: "johndoe",
    });
  });

  it("finishes on an approval that carries a session", () => {
    const tokens = { accessToken: "a", refreshToken: "r", expiresInMillis: 900000 };
    expect(nextQrView(showing, answer({ status: "APPROVED", tokens }))).toEqual({ phase: "approved" });
  });

  it("treats an approval without a session as expired", () => {
    expect(nextQrView(showing, answer({ status: "APPROVED" }))).toEqual({ phase: "expired" });
  });

  it("stops on a rejection or an expiry", () => {
    expect(nextQrView(showing, answer({ status: "REJECTED" }))).toEqual({ phase: "rejected" });
    expect(nextQrView(showing, answer({ status: "EXPIRED" }))).toEqual({ phase: "expired" });
  });

  it("ignores a late answer once the step has moved on", () => {
    const expired: QrView = { phase: "expired" };
    expect(nextQrView(expired, answer({ status: "SCANNED", username: "x" }))).toBe(expired);
  });
});

describe("hasLapsed", () => {
  const deadline = Date.parse(code.expiresAt);

  it("is true for an unscanned code past its deadline", () => {
    expect(hasLapsed(showing, deadline - 1)).toBe(false);
    expect(hasLapsed(showing, deadline)).toBe(true);
  });

  it("leaves a scanned code to the server", () => {
    expect(hasLapsed({ ...showing, scannedBy: "johndoe" }, deadline + 60_000)).toBe(false);
  });
});
