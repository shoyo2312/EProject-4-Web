// @vitest-environment node
import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
// Next 16.4.2 exports the matcher helper under its pre-16 name; the bundled docs' doesProxyMatch does not exist.
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";

import { config, DEVICE_COOKIE, proxy } from "@/proxy";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const KNOWN = "0f8fad5b-d9cb-469f-a165-70867728950e";
const TAMPERED = ["short", "x".repeat(500), "not-a-uuid-but-long-enough-0001", KNOWN.toUpperCase()];

/** The header the request carries on to the gateway, as NextResponse.next({ request }) encodes it. */
const forwarded = (res: Response) => res.headers.get("x-middleware-request-x-device-id");

const authCall = (headers: Record<string, string> = {}) =>
  proxy(new NextRequest("http://localhost:3000/api/v1/auth/login", { method: "POST", headers }));

const page = (headers: Record<string, string> = {}) =>
  proxy(new NextRequest("http://localhost:3000/foryou", { headers }));

describe("proxy, on an auth call", () => {
  it("carries the browser's id to auth-service as X-Device-Id", () => {
    expect(forwarded(authCall({ cookie: `${DEVICE_COOKIE}=${KNOWN}` }))).toBe(KNOWN);
  });

  it("overwrites an X-Device-Id the page wrote itself", () => {
    const res = authCall({ cookie: `${DEVICE_COOKIE}=${KNOWN}`, "x-device-id": "chosen-by-the-page-0001" });

    expect(forwarded(res)).toBe(KNOWN);
  });

  /** Without a cookie of ours there is no id at all — never one the page chose. */
  it("sends no id when the browser has no valid cookie", () => {
    for (const cookie of [undefined, ...TAMPERED]) {
      const headers: Record<string, string> = { "x-device-id": "chosen-by-the-page-0001" };
      if (cookie) headers.cookie = `${DEVICE_COOKIE}=${cookie}`;

      const res = authCall(headers);

      expect(forwarded(res)).toBeNull();
      expect(res.headers.get("x-middleware-override-headers")).not.toContain("x-device-id");
    }
  });

  /** Next sends a rewritten call's response back as the gateway wrote it: a cookie set here is lost. */
  it("sets no cookie, since Next would drop it", () => {
    expect(authCall().cookies.get(DEVICE_COOKIE)).toBeUndefined();
  });
});

describe("proxy, on a page", () => {
  it("gives a browser without the cookie an id", () => {
    const set = page().cookies.get(DEVICE_COOKIE);

    expect(set?.value).toMatch(UUID);
    expect(set).toMatchObject({ httpOnly: true, sameSite: "lax", path: "/api/v1/auth", maxAge: 31536000 });
  });

  it("leaves the id a browser already has alone", () => {
    expect(page({ cookie: `${DEVICE_COOKIE}=${KNOWN}` }).cookies.get(DEVICE_COOKIE)).toBeUndefined();
  });

  it("replacesATamperedCookie", () => {
    for (const bad of TAMPERED) {
      const set = page({ cookie: `${DEVICE_COOKIE}=${bad}` }).cookies.get(DEVICE_COOKIE);

      expect(set?.value).toMatch(UUID);
      expect(set?.value).not.toBe(bad);
    }
  });
});

describe("proxy, where it runs", () => {
  it("runs on auth calls and pages, not the rest of the API or Next's own files", () => {
    for (const url of ["/api/v1/auth/refresh", "/", "/foryou", "/@nora.v"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(true);
    }
    for (const url of ["/api/v1/videos/feed", "/_next/static/chunks/app.js", "/_next/image"]) {
      expect(unstable_doesMiddlewareMatch({ config, url })).toBe(false);
    }
  });
});
