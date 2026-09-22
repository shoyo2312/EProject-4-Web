import type { Metadata } from "next";

import { FollowFeed } from "@/components/following/FollowFeed";

export const metadata: Metadata = {
  title: "Friends - Watch videos from friends who follow you back | Nowa",
  description:
    "Watch videos from the people you follow who follow you back on Nowa.",
};

/**
 * "Friends" — the mutuals slice of `/following`: same component, same feed
 * endpoint, drawn from the accounts that follow the viewer back.
 */
export default function FriendsPage() {
  return <FollowFeed source="friends" />;
}
