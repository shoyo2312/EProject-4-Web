import type { Metadata } from "next";

import { FollowFeed } from "@/components/following/FollowFeed";

export const metadata: Metadata = {
  // Verbatim from the live document title.
  title: "Following - Watch videos from creators you follow | Nowa",
  description:
    "Watch videos from the creators you follow on Nowa, and find new ones to follow.",
};

/**
 * "Following" — videos from the accounts the viewer follows. The sidebar, top
 * bar and page chrome come from `app/layout.tsx`; this route only owns the
 * content column.
 *
 * Nothing is fetched here: both the feed and the creator suggestions it falls
 * back to need a token, and the session only exists in the browser.
 */
export default function FollowingPage() {
  return <FollowFeed />;
}
