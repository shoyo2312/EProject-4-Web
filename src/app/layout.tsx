import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

import { TopBar } from "@/components/layout/TopBar";
import { ChatUnreadProvider } from "@/components/messages/ChatUnreadProvider";
import { FloatingChat } from "@/components/messages/floating/FloatingChat";
import { PlayerSettingsProvider } from "@/components/player/PlayerSettingsProvider";
import { ScreenTimeGuard } from "@/components/screen-time/ScreenTimeGuard";
import { SleepHoursScreen } from "@/components/screen-time/SleepHoursScreen";
import { SessionProvider } from "@/components/session/SessionProvider";
import { HighContrastSync } from "@/components/settings/HighContrastSync";
import { StoriesProvider } from "@/components/stories/StoriesProvider";
import { Toaster } from "@/components/ui/toast";
import { AccountSettingsProvider } from "@/hooks/use-account-settings";
import { LOGIN_OPTIONS, SIGNUP_OPTIONS } from "@/lib/site-config";

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
export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // The viewer is NOT resolved here: the JWT pair lives in the browser, so the
  // server renders the signed-out shell and `SessionProvider` fills it in from
  // `GET /api/v1/me` on mount.
  return (
    <html lang="en" className={`${tiktokFont.variable} h-full antialiased`}>
      <body className="min-h-full">
        <SessionProvider loginOptions={LOGIN_OPTIONS} signupOptions={SIGNUP_OPTIONS}>
          {/* Renders nothing; writes the accessibility class on <html>, which
              every route reads through the design tokens. */}
          <HighContrastSync />

          {/* The account's settings, read once: /setting shows them, and the
              notification gates, the screen-time guard and the sleep screen act on
              every page. */}
          <AccountSettingsProvider>
            {/* Renders nothing; counts the signed-in viewer's time on the site. */}
            <ScreenTimeGuard />

            {/* Sound is a viewer preference shared by the feed and /video/[id],
                so it lives above the route that happens to be mounted. */}
            <PlayerSettingsProvider>
              {/* Story rings, and the player a ring opens. Avatars on /video/[id] and on every
                  shell page ask it, so it sits above the routes. */}
              <StoriesProvider>
                {/* One unread tally and one floating chat for every route, so a message counts, and
                    the panel stays open, while the viewer moves between pages. */}
                <ChatUnreadProvider>
                  <div className="flex min-h-screen flex-col">
                    <div className="flex h-screen justify-between bg-[var(--tt-page)]">
                      {children}
                    </div>

                    <TopBar />
                  </div>
                  <FloatingChat />
                </ChatUnreadProvider>
              </StoriesProvider>
            </PlayerSettingsProvider>
            <SleepHoursScreen />
          </AccountSettingsProvider>
          <Toaster />
        </SessionProvider>
      </body>
    </html>
  );
}
