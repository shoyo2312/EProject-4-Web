import type { Metadata } from "next";

import { SuggestedCreators } from "@/components/following/SuggestedCreators";
import { getSuggestedCreators } from "@/lib/data";

export const metadata: Metadata = {
  // Verbatim from the live document title.
  title: "Following - Watch videos from creators you follow | TikTok",
  description:
    "Watch videos from the creators you follow on TikTok, and find new ones to follow.",
};

/**
 * "Following" — the creator suggestion grid. The sidebar, top bar and page
 * chrome come from `app/layout.tsx`; this route only owns the content column.
 */
export default async function FollowingPage() {
  const creators = await getSuggestedCreators();

  return <SuggestedCreators creators={creators} />;
}
