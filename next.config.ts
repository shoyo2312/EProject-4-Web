import type { NextConfig } from "next";

/**
 * Where the Spring Cloud Gateway lives. Every backend call goes through it —
 * never straight to auth-service:8081 / user-service:8082 / video-service:8083,
 * which is what the API contracts in `tiktok-backend/docs` require.
 */
const GATEWAY_URL = process.env.API_GATEWAY_URL ?? "http://localhost:8080";

/**
 * The CDN that serves avatars and thumbnails. It must match user-service's
 * `avatarUrl` allow-list and video-service's `media.allowed-hosts` — those
 * decide which URLs the backend will store, and this decides which ones
 * `next/image` will load. A host allowed there but missing here shows up as a
 * broken image with an "un-configured host" error.
 */
const MEDIA_CDN_HOST = process.env.MEDIA_CDN_HOST ?? "cdn.tiktok-clone.local";

/**
 * Where the identity providers host the picture a social signup arrives with.
 * user-service stores that URL as-is on the new profile — it is not our media,
 * so it is not on the CDN and deliberately not on the `avatarUrl` allow-list —
 * which leaves this the only place deciding whether such an avatar renders.
 * Without it a Google or Facebook signup shows a broken image instead of the
 * default avatar, which is worse than the problem the picture was to solve.
 */
const PROVIDER_AVATAR_HOSTS = [
  "lh3.googleusercontent.com",
  "platform-lookaside.fbsbx.com",
];

/**
 * The object storage itself, which in development is MinIO on :9000 with no CDN
 * in front of it. media-worker copies each provider avatar there and hands
 * user-service that URL, so a mirrored avatar is served from this origin rather
 * than from the CDN host above — different port, so `next/image` treats it as a
 * different pattern.
 */
const MEDIA_ORIGIN = new URL(process.env.MEDIA_ORIGIN ?? "http://localhost:9000");

/** True while media is served from the developer's own machine. */
const LOCAL_MEDIA_ORIGIN = ["localhost", "127.0.0.1", "0.0.0.0", "[::1]"].includes(
  MEDIA_ORIGIN.hostname,
);

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [
      { protocol: "https", hostname: MEDIA_CDN_HOST },
      {
        protocol: MEDIA_ORIGIN.protocol.replace(":", "") as "http" | "https",
        hostname: MEDIA_ORIGIN.hostname,
        port: MEDIA_ORIGIN.port,
      },
      ...PROVIDER_AVATAR_HOSTS.map((hostname) => ({
        protocol: "https" as const,
        hostname,
      })),
    ],

    /**
     * Next 16 refuses to optimize an image whose host resolves to a local or
     * private address, so the dev MinIO on localhost:9000 answers every avatar
     * with a 400 ("url parameter is not allowed") however the pattern above is
     * written. Allowed only when the media origin is itself local — a real
     * deployment serves media from the CDN and must keep the block.
     */
    dangerouslyAllowLocalIP: LOCAL_MEDIA_ORIGIN,
  },

  /**
   * The browser calls `/api/v1/...` on its own origin and Next proxies it to the
   * gateway. Two reasons this is a rewrite rather than a direct cross-origin
   * fetch:
   *
   *  - the gateway ships no CORS configuration, so a direct `fetch` from
   *    localhost:3000 to :8080 is blocked by the browser before it is even sent;
   *  - same-origin keeps the door open to moving tokens into httpOnly cookies
   *    later without changing a single call site.
   *
   * Note for load testing: the gateway rate-limits 20 req/s per **IP**, and
   * behind this proxy every viewer shares the Next server's IP.
   */
  /**
   * The client hints auth-service's security log needs. A browser sends them only after it has
   * seen `Accept-CH` from the origin it is talking to, which is this app — the gateway is reached
   * through the rewrite below and never directly, so asking from there would reach nobody.
   *
   *  - `Sec-CH-UA-Model` is the only way the web will name a device. The user agent stopped
   *    carrying it: Chrome freezes the Android model to the literal "K". Chromium answers this
   *    with "" on every desktop platform by specification, so it names Android phones and nothing
   *    else — Apple hardware is not exposed by any browser, by any means.
   *  - `Sec-CH-UA-Platform-Version` is the real OS version; the agent's is frozen at 10.15 on
   *    every Mac ever made.
   *
   * Safari and Firefox implement no client hints, so those sign-ins keep falling back to the
   * agent. The rewrite forwards these headers itself, being a proxy rather than a fresh request.
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Accept-CH", value: "Sec-CH-UA-Model, Sec-CH-UA-Platform-Version" },
        ],
      },
    ];
  },

  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${GATEWAY_URL}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
