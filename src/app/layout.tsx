import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { TopBar } from "@/components/layout/TopBar";
import { PlayerSettingsProvider } from "@/components/player/PlayerSettingsProvider";
import { SessionProvider } from "@/components/session/SessionProvider";
import { getLoginOptions } from "@/lib/data";

// TikTok ships a proprietary self-hosted webfont ("TikTokFont") that cannot be
// redistributed. Inter is the closest freely-licensable match by metrics.
// Only weights 500 and 700 appear anywhere on the target page.
const tiktokFont = Inter({
  variable: "--font-tiktok",
  subsets: ["latin", "vietnamese"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: "Nowa - Make Your Day",
  description:
    "Nowa - trends start here. On a device or on the web, viewers can watch and discover millions of personalized short videos. Download the app to get started.",
};

/**
 * The outermost frame, shared by every route — it mirrors the live DOM:
 *
 *   body > #app (flex column)
 *     > .BaseBodyContainer (flex row, justify-content: space-between, bg #000)
 *       > {children}
 *
 * The sidebar is NOT here: it belongs to the `(shell)` route group, because the
 * single-video view renders full-bleed without it. A new page that wants the
 * nav therefore goes in `app/(shell)/<route>/page.tsx`; one that wants the full
 * width goes directly in `app/<route>/page.tsx`. Either way it renders its own
 * `<main>` and inherits the top bar from here.
 */
export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The viewer is NOT resolved here: the JWT pair lives in the browser, so the
  // server renders the signed-out shell and `SessionProvider` fills it in from
  // `GET /api/v1/me` on mount.
  const loginOptions = await getLoginOptions();

  return (
    <html lang="en" className={`${tiktokFont.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SessionProvider loginOptions={loginOptions}>
          {/* Sound is a viewer preference shared by the feed and /video/[id],
              so it lives above the route that happens to be mounted. */}
          <PlayerSettingsProvider>
            <div className="flex min-h-screen flex-col">
              <div className="flex h-screen justify-between bg-[var(--tt-page)]">
                {children}
              </div>

              <TopBar />
            </div>
          </PlayerSettingsProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
