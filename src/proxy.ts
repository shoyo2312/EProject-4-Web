import { NextResponse, type NextRequest } from "next/server";

/**
 * Gives each browser a random device id and sends it as `X-Device-Id` on every call under
 * `/api/v1/auth/*`, so auth-service can tell a sign-in from a browser the account has used before
 * from one it has not — and tell the account's owner only about the second.
 *
 * - **A cookie this server sets, not localStorage.** WebKit (Safari, and every browser on iOS)
 *   deletes script-written storage after seven days without a visit, so each return after a week
 *   would look like a new device. A cookie set in a response from the site's own server is not
 *   under that limit.
 * - **Set on pages, read on auth calls.** `/api/*` is proxied straight to the gateway, and Next
 *   sends that response back exactly as the gateway wrote it — a cookie set here on an auth call
 *   is silently dropped (so is `Accept-CH`, from next.config). A page always loads before a
 *   sign-in can be sent, so the page is where the cookie is minted.
 * - **HttpOnly, Path `/`.** No script reads it. The browser sends it with every request to this
 *   site, because the page is where it is read too: a cookie scoped to `/api/v1/auth` never comes
 *   back on a page, so every page would mint a fresh id and every sign-in would look like a new
 *   device. Only auth calls turn it into `X-Device-Id`; the rest of the API never runs this proxy.
 * - **Not a credential.** Knowing it only keeps an alert quiet; signing in still takes the password.
 *   An `X-Device-Id` the page wrote itself never reaches the gateway: the header carries the
 *   cookie's id or nothing.
 * - `X-Forwarded-For` is left alone on purpose: Next fills it from the socket when it is absent,
 *   so what reaches this function may be Next's own value, and dropping it would put every visitor
 *   on this server's address.
 *
 * The cookie is not renewed: once it lapses, the next page mints a new id, and the session's next
 * refresh makes it known without an alert.
 */
export const DEVICE_COOKIE = "nowa_device";

/** What `crypto.randomUUID()` mints. Anything else in the cookie is replaced, never forwarded. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const ONE_YEAR_SECONDS = 60 * 60 * 24 * 365;

export function proxy(request: NextRequest): NextResponse {
  const held = request.cookies.get(DEVICE_COOKIE)?.value;
  const id = held !== undefined && UUID.test(held) ? held : undefined;

  if (request.nextUrl.pathname.startsWith("/api/")) {
    const headers = new Headers(request.headers);
    if (id) {
      headers.set("x-device-id", id);
    } else {
      headers.delete("x-device-id");
    }
    return NextResponse.next({ request: { headers } });
  }

  const response = NextResponse.next();
  if (!id) {
    response.cookies.set({
      name: DEVICE_COOKIE,
      value: crypto.randomUUID(),
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: ONE_YEAR_SECONDS,
      secure: process.env.NODE_ENV === "production",
    });
  }
  return response;
}

export const config = {
  matcher: [
    "/api/v1/auth/:path*",
    // Pages (and files from public/), not the rest of the API and not Next's own assets.
    "/((?!api/|_next/).*)",
  ],
};
