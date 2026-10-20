"use client";

import { Feed } from "@/components/feed/Feed";
import { FeedSkeleton } from "@/components/feed/LiveFeed";
import { SuggestedCreators } from "@/components/following/SuggestedCreators";
import { StoryBar } from "@/components/stories/StoryTray";
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
  // The feed's ids, cursor and cards are one account's; the sidebar keeps this
  // page mounted across a sign-out or an account switch, so a new viewer starts
  // a new instance instead of paging on from the last one's.
  return <ViewerFollowFeed key={user?.userId ?? "guest"} source={source} />;
}

function ViewerFollowFeed({ source }: { source: FollowFeedSource }) {
  const { user } = useSession();
  const { videos, isLoading, error, loadMore, followedIds } =
    useFollowFeed(source);

  // Nobody suggests you follow yourself, or somebody you already follow.
  const exclude = user ? [user.userId, ...followedIds] : followedIds;

  // Stories ride on Following only: Friends is the same people narrowed, and one tray is enough.
  const stories =
    source === "following" ? <StoryBar followedIds={isLoading ? null : followedIds} /> : null;

  if (isLoading) {
    return <FeedSkeleton />;
  }

  if (error) {
    return (
      <div className="relative flex-1">
        <div className="absolute inset-x-0 top-0 z-20 bg-[var(--tt-red-active)]/90 px-4 py-2 text-center text-[13px] leading-5 text-white">
          Can’t connect right now — showing creators to follow.
        </div>
        <SuggestedCreators exclude={exclude} />
      </div>
    );
  }

  if (videos.length === 0) {
    return (
      <div className="flex flex-1 flex-col">
        {stories}
        <SuggestedCreators exclude={exclude} />
      </div>
    );
  }

  return (
    <div className="relative flex flex-1">
      {/* Over the feed rather than above it: the feed is a full-height snap list. Kept clear of
          the top bar's buttons on the right. */}
      {stories && (
        <div className="absolute top-0 left-0 z-20 max-w-[calc(100%-320px)] tt-1024:max-w-[calc(100%-200px)]">
          {stories}
        </div>
      )}
      <Feed videos={videos} onReachEnd={loadMore} />
    </div>
  );
}
