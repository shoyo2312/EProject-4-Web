"use client";

import { Feed } from "@/components/feed/Feed";
import { FeedSkeleton } from "@/components/feed/LiveFeed";
import { SuggestedCreators } from "@/components/following/SuggestedCreators";
import { useFollowingFeed } from "@/hooks/use-following-feed";
import type { SuggestedCreator } from "@/types/tiktok";

/**
 * `/following`, backed by `GET /api/v1/videos/feed/following`.
 *
 * The live page has two faces and so does this one: a viewer with videos from
 * the accounts they follow gets the same vertical feed as For You, and everyone
 * else — signed out, following nobody, or following people who have not posted
 * — gets the creator grid, which is the state the live site was measured in.
 *
 * The grid is also the error state. It is real page content rather than a mock
 * feed passed off as real, so unlike For You there is nothing to hide here when
 * the gateway is unreachable: the banner says what happened and the suggestions
 * below it are still worth showing.
 */
export function FollowingFeed({ creators }: { creators: SuggestedCreator[] }) {
  const { videos, isLoading, error, loadMore } = useFollowingFeed();

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 z-20 bg-[var(--tt-red-active)]/90 px-4 py-2 text-center text-[13px] leading-5 text-white">
          Can’t reach the API gateway on :8080 — showing creators to follow.
        </div>
        <SuggestedCreators creators={creators} />
      </div>
    );
  }

  if (videos.length === 0) {
    return <SuggestedCreators creators={creators} />;
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
