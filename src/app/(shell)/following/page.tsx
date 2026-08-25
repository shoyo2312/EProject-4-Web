import type { Metadata } from "next";

import { FollowingFeed } from "@/components/following/FollowingFeed";
import { getSuggestedCreators } from "@/lib/data";

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
 * Stays a server component so the mock module never reaches the client bundle:
 * it loads the creator suggestions and hands them down as the empty and error
 * state, and `FollowingFeed` does the fetching — the session, and therefore the
 * token the follow listing needs, only exists in the browser.
 */
export default async function FollowingPage() {
  const creators = await getSuggestedCreators();

  return <FollowingFeed creators={creators} />;
}
