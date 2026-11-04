"use client";

import Link from "next/link";

import { CommentRow } from "@/components/studio/CommentRow";
import { MetricTabs } from "@/components/studio/MetricTabs";
import { PostCell } from "@/components/studio/PostCell";
import { useStudioRange } from "@/components/studio/StudioRange";
import { EmptyState, RangeSelect, SectionTitle, StudioCard, StudioSkeleton } from "@/components/studio/ui";
import { useSession } from "@/components/session/SessionProvider";
import { useCommentContext } from "@/hooks/use-comment-context";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { getCreatorOverview, listInboxComments, listStudioPosts } from "@/lib/api/studio";
import { getUserVideoStats } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { overviewMetrics } from "@/lib/studio/overview";

/** `/studio` — TikTok Studio's Home: who you are, key metrics, recent posts and comments. */
export function StudioHome() {
  const { days, setDays } = useStudioRange();
  const overview = useStudioQuery(`overview:${days}`, (signal) => getCreatorOverview(days, signal));

  return (
    <div className="flex flex-col gap-8">
      <ProfileCard />

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link href="/studio/analytics">
            <SectionTitle chevron>Key metrics</SectionTitle>
          </Link>
          <RangeSelect days={days} onChange={setDays} />
        </div>
        {overview.error ? (
          <StudioCard>
            <EmptyState>{overview.error}</EmptyState>
          </StudioCard>
        ) : (
          <MetricTabs
            metrics={overview.data && overviewMetrics(overview.data)}
            days={overview.data?.daily.map((d) => d.day) ?? []}
          />
        )}
      </section>

      <RecentPosts />
      <LatestComments />
    </div>
  );
}

function ProfileCard() {
  const { user } = useSession();
  const stats = useStudioQuery(`stats:${user?.userId}`, (signal) => getUserVideoStats(user!.userId, signal));
  if (!user) return null;

  return (
    <StudioCard className="flex items-center gap-4 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- the viewer's own avatar */}
      <img src={user.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-12 w-12 rounded-full object-cover" />
      <div className="flex flex-col gap-0.5">
        <p className="text-[16px] leading-5 font-bold">{user.handle ?? user.nickname}</p>
        <p className="text-[14px] leading-5 text-black">
          Likes {stats.data ? formatCount(stats.data.totalLikes) : "–"} · Followers {formatCount(user.followerCount)} ·
          Following {formatCount(user.followingCount)}
        </p>
      </div>
    </StudioCard>
  );
}

function RecentPosts() {
  const posts = useStudioQuery("recent-posts", (signal) => listStudioPosts({ size: 3 }, signal));
  const items = posts.data?.content;

  return (
    <section className="flex flex-col gap-4">
      <Link href="/studio/content">
        <SectionTitle chevron>Recent posts</SectionTitle>
      </Link>
      <StudioCard>
        {!items ? (
          <div className="flex flex-col gap-3 p-5">
            <StudioSkeleton className="h-[72px]" />
            <StudioSkeleton className="h-[72px]" />
          </div>
        ) : items.length === 0 ? (
          <EmptyState>No posts yet</EmptyState>
        ) : (
          <ul className="divide-y divide-black/8">
            {items.map((video) => (
              <li key={video.id} className="flex items-center gap-6 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <PostCell video={video} href={`/studio/analytics/${video.id}`} />
                </div>
                <PostNumbers views={video.viewCount} likes={video.likeCount} comments={video.commentCount} />
              </li>
            ))}
          </ul>
        )}
      </StudioCard>
    </section>
  );
}

function PostNumbers({ views, likes, comments }: { views: number; likes: number; comments: number | null }) {
  return (
    <dl className="flex flex-none gap-6 text-center text-[12px] leading-4 text-black/50">
      {[
        ["Views", views],
        ["Likes", likes],
        ["Comments", comments],
      ].map(([label, value]) => (
        <div key={label} className="flex w-16 flex-col gap-0.5">
          <dd className="text-[16px] leading-5 font-semibold text-black">
            {value === null ? "–" : formatCount(value as number)}
          </dd>
          <dt>{label}</dt>
        </div>
      ))}
    </dl>
  );
}

function LatestComments() {
  const page = useStudioQuery("latest-comments", (signal) => listInboxComments({}, undefined, 3, signal));
  const comments = page.data?.items ?? [];
  const { authors, videos } = useCommentContext(comments);

  return (
    <section className="flex flex-col gap-4">
      <Link href="/studio/comment">
        <SectionTitle chevron>Latest comments</SectionTitle>
      </Link>
      <StudioCard>
        {!page.data ? (
          <div className="p-5">
            <StudioSkeleton className="h-14" />
          </div>
        ) : comments.length === 0 ? (
          <EmptyState>No comments yet</EmptyState>
        ) : (
          <ul className="divide-y divide-black/8">
            {comments.map((comment) => (
              <li key={comment.commentId}>
                <CommentRow
                  comment={comment}
                  author={authors.get(comment.userId)}
                  video={videos.get(comment.videoId)}
                />
              </li>
            ))}
          </ul>
        )}
      </StudioCard>
    </section>
  );
}
