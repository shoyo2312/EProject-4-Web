"use client";

import Link from "next/link";
import { useState } from "react";

import { CommentRow } from "@/components/studio/CommentRow";
import { MetricTabs } from "@/components/studio/MetricTabs";
import { PostCell } from "@/components/studio/PostCell";
import { POSTS_POLL_MS } from "@/components/studio/StudioPosts";
import { useStudioRange } from "@/components/studio/StudioRange";
import {
  EmptyState,
  RangeSelect,
  SectionTitle,
  StudioCard,
  StudioSkeleton,
} from "@/components/studio/ui";
import { useSession } from "@/components/session/SessionProvider";
import { useCommentContext } from "@/hooks/use-comment-context";
import { useMyStudioPulse } from "@/hooks/use-studio-pulse";
import { ANALYTICS_REFRESH_MS, useStudioQuery } from "@/hooks/use-studio-query";
import { INBOX_POLL_MS } from "@/hooks/use-inbox-comments";
import { useVideoChanges, withCounts } from "@/hooks/use-video-changes";
import {
  getCreatorOverview,
  listInboxComments,
  listStudioPosts,
} from "@/lib/api/studio";
import type { VideoResponse } from "@/lib/api/types";
import { getUserVideoStats } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { overviewMetrics } from "@/lib/studio/overview";

/** `/studio` — TikTok Studio's Home: who you are, key metrics, recent posts and comments. */
export function StudioHome() {
  const { days, setDays } = useStudioRange();
  const overview = useStudioQuery(
    `overview:${days}`,
    (signal) => getCreatorOverview(days, signal),
    ANALYTICS_REFRESH_MS,
  );
  useMyStudioPulse(overview.refresh);

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
  const stats = useStudioQuery(`stats:${user?.userId}`, (signal) =>
    getUserVideoStats(user!.userId, signal),
  );
  // The frame is sent once video-service has the new total, so it is read straight away.
  useMyStudioPulse(stats.refresh, 0);
  if (!user)
    return (
      <StudioCard className="flex items-center gap-4 p-5" aria-hidden>
        <StudioSkeleton className="h-12 w-12 flex-none rounded-full" />
        <div className="flex flex-col gap-0.5">
          <StudioSkeleton className="h-5 w-[120px]" />
          <StudioSkeleton className="h-5 w-[262px]" />
        </div>
      </StudioCard>
    );

  return (
    <StudioCard className="flex items-center gap-4 p-5">
      {/* eslint-disable-next-line @next/next/no-img-element -- the viewer's own avatar */}
      <img
        src={user.avatarUrl}
        alt=""
        referrerPolicy="no-referrer"
        className="h-12 w-12 rounded-full object-cover"
      />
      <div className="flex flex-col gap-0.5">
        <p className="text-[16px] leading-5 font-bold">
          {user.handle ?? user.nickname}
        </p>
        <p className="text-[14px] leading-5 text-black">
          Likes {stats.data ? formatCount(stats.data.totalLikes) : "–"} ·
          Followers {formatCount(user.followerCount)} · Following{" "}
          {formatCount(user.followingCount)}
        </p>
      </div>
    </StudioCard>
  );
}

function RecentPosts() {
  // Asked again for a post just uploaded or a verdict just given; counters come by frame below.
  const posts = useStudioQuery(
    "recent-posts",
    (signal) => listStudioPosts({ size: 3 }, signal),
    POSTS_POLL_MS,
  );
  // Edits seen since this answer arrived. Tied to the answer, so a newer one from the server is
  // never painted over by an older edit.
  const [patched, setPatched] = useState<{
    base: unknown;
    videos: Record<string, VideoResponse>;
  }>({
    base: null,
    videos: {},
  });
  const edits = patched.base === posts.data ? patched.videos : {};
  const items = posts.data?.content.map((video) => edits[video.id] ?? video);
  const shown = items?.map((video) => video.id) ?? [];
  useVideoChanges(shown, {
    onUpdated: (video) => {
      if (!shown.includes(video.id)) return;
      // Functional: a return to the tab reports all three at once, and each must keep the others.
      setPatched((current) => ({
        base: posts.data,
        videos: {
          ...(current.base === posts.data ? current.videos : {}),
          [video.id]: video,
        },
      }));
    },
    // The three newest, so a delete pulls the fourth up: asked again rather than patched.
    onDeleted: (id) => {
      if (shown.includes(id)) posts.reload();
    },
    // A view, like or comment from anyone, the moment it happens.
    onCounts: (frame) => {
      const base = posts.data?.content.find((video) => video.id === frame.videoId);
      if (!base) return;
      setPatched((current) => {
        const videos = current.base === posts.data ? current.videos : {};
        return {
          base: posts.data,
          videos: { ...videos, [frame.videoId]: withCounts(videos[frame.videoId] ?? base, frame) },
        };
      });
    },
  });

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
                  <PostCell
                    video={video}
                    href={`/studio/analytics/${video.id}`}
                  />
                </div>
                {video.status === "FAILED" ? (
                  <PostNumbers views={null} likes={null} comments={null} />
                ) : (
                  <PostNumbers
                    views={video.viewCount}
                    likes={video.likeCount}
                    comments={video.commentCount}
                  />
                )}
              </li>
            ))}
          </ul>
        )}
      </StudioCard>
    </section>
  );
}

/** A null number reads as a dash: unknown, or a failed upload that can never have one. */
function PostNumbers({
  views,
  likes,
  comments,
}: {
  views: number | null;
  likes: number | null;
  comments: number | null;
}) {
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
  // Nothing pushes a comment on my posts to Studio — and a held one publishes nothing at all.
  const page = useStudioQuery(
    "latest-comments",
    (signal) => listInboxComments({}, undefined, 3, signal),
    INBOX_POLL_MS,
  );
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
