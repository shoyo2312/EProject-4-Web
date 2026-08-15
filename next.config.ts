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

const nextConfig: NextConfig = {
  output: "standalone",

  images: {
    remotePatterns: [{ protocol: "https", hostname: MEDIA_CDN_HOST }],
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
