import type { Metadata } from "next";

import { FollowFeed } from "@/components/following/FollowFeed";
import { getSuggestedCreators } from "@/lib/data";

export const metadata: Metadata = {
  title: "Friends - Watch videos from friends who follow you back | Nowa",
  description:
    "Watch videos from the people you follow who follow you back on Nowa.",
};

/**
 * "Friends" — the mutuals slice of `/following`: same component, same feed
 * endpoint, drawn from the accounts that follow the viewer back.
 *
 * A server component for the same reason `/following` is: the mock creator grid
 * it falls back to stays out of the client bundle, and the fetching needs a
 * token that only exists in the browser.
 */
export default async function FriendsPage() {
  const creators = await getSuggestedCreators();

  return <FollowFeed creators={creators} source="friends" />;
}
