"use client";

import { Feed } from "@/components/feed/Feed";
import { FeedSkeleton } from "@/components/feed/LiveFeed";
import { SuggestedCreators } from "@/components/following/SuggestedCreators";
import { useSession } from "@/components/session/SessionProvider";
import { useFollowFeed, type FollowFeedSource } from "@/hooks/use-follow-feed";

/**
 * `/following` and `/friends`, both backed by `GET /videos/feed/following`.
 *
 * One component for two routes: the pages differ only in which accounts the
 * feed is drawn from — everybody the viewer follows, or just the mutuals — and
 * the live site renders them identically otherwise.
 *
 * Each has two faces, as the live site does. A viewer with videos gets the same
 * vertical feed as For You; everyone else — signed out, an empty follow graph,
 * or people who have not posted — gets the creator grid, which is the state the
 * live pages were measured in.
 *
 * The grid is also the error state. It is real page content — real accounts
 * from the public feed — so unlike For You there is nothing to hide here when
 * the following feed fails: the banner says what happened and the suggestions
 * below it are still worth showing.
 */
export function FollowFeed({
  source = "following",
}: {
  source?: FollowFeedSource;
}) {
  const { user } = useSession();
  const { videos, isLoading, error, loadMore, followedIds } =
    useFollowFeed(source);

  // Nobody suggests you follow yourself, or somebody you already follow.
  const exclude = user ? [user.userId, ...followedIds] : followedIds;

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 z-20 bg-[var(--tt-red-active)]/90 px-4 py-2 text-center text-[13px] leading-5 text-white">
          Can’t reach the API gateway on :8080 — showing creators to follow.
        </div>
        <SuggestedCreators exclude={exclude} />
      </div>
    );
  }

  if (videos.length === 0) {
    return <SuggestedCreators exclude={exclude} />;
  }

  return (
    <Feed
      videos={videos}
      // `CommentPanel` fetches real comments itself for these (numeric) ids —
      // same as the For You feed, this map serves nothing here.
      comments={{}}
      onReachEnd={loadMore}
    />
  );
}
