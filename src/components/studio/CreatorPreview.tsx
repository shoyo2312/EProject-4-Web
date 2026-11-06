"use client";

import { Play, User, X } from "lucide-react";
import Link from "next/link";

import { onPlainClick, useOpenStudioVideo } from "@/components/studio/StudioVideoModal";
import { EmptyState } from "@/components/studio/ui";
import { Modal } from "@/components/ui/modal";
import { useFollow } from "@/hooks/use-follow";
import { useStudioQuery } from "@/hooks/use-studio-query";
import type { UserProfileResponse } from "@/lib/api/types";
import { getUserVideoStats, getUserVideos } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

/** One screen of posts: the popup previews a creator, the profile is a click away. */
const PREVIEW_VIDEOS = 12;

/**
 * TikTok Studio's creator popup on Inspiration: the account at a glance — follow
 * counts, bio, a Follow button and its latest posts — without leaving Studio.
 */
export function CreatorPreview({ profile, onClose }: { profile: UserProfileResponse; onClose: () => void }) {
  const { userId, username } = profile;
  const name = profile.displayName || username || "Nowa user";
  const openVideo = useOpenStudioVideo();
  const { isSelf, following, requested, ready, toggle } = useFollow(userId);
  const stats = useStudioQuery(`creator:stats:${userId}`, (signal) => getUserVideoStats(userId, signal));
  const videos = useStudioQuery(`creator:videos:${userId}`, (signal) =>
    getUserVideos(userId, 0, PREVIEW_VIDEOS, signal),
  );

  return (
    <Modal onClose={onClose} className="flex max-h-[85vh] w-[620px] flex-col rounded-[12px] bg-white p-5 text-black">
      <div className="flex gap-5">
        {profile.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatars come from any host user-service allowed
          <img
            src={profile.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-28 w-28 flex-none rounded-full object-cover"
          />
        ) : (
          <span className="flex h-28 w-28 flex-none items-center justify-center rounded-full bg-black/8">
            <User className="h-10 w-10" strokeWidth={1.5} />
          </span>
        )}
        <div className="flex min-w-0 flex-1 flex-col items-start gap-2">
          <div className="flex w-full items-center gap-3">
            <h2 className="truncate text-[17px] leading-6 font-semibold">{name}</h2>
            {username && (
              <Link
                href={`/@${username}`}
                target="_blank"
                className="flex-none text-[14px] font-medium text-[var(--tt-red)] hover:underline"
              >
                View on Nowa
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="ml-auto flex h-8 w-8 flex-none items-center justify-center rounded-full hover:bg-black/5"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          {!isSelf && (
            <button
              type="button"
              onClick={toggle}
              disabled={!ready}
              className={cn(
                "h-9 w-36 rounded-[8px] text-[15px] font-semibold transition-colors disabled:opacity-40",
                following || requested
                  ? "bg-black/5 text-black hover:bg-black/10"
                  : "bg-[var(--tt-red)] text-white hover:bg-[var(--tt-red-hover)]",
              )}
            >
              {following ? "Following" : requested ? "Requested" : "Follow"}
            </button>
          )}
          <div className="flex gap-4 text-[15px] text-black/60">
            <Stat value={profile.followingCount} label="Following" />
            <Stat value={profile.followerCount} label="Followers" />
            {stats.data && <Stat value={stats.data.totalLikes} label="Likes" />}
          </div>
          {profile.bio && <p className="text-[14px] leading-5 whitespace-pre-line text-black/75">{profile.bio}</p>}
        </div>
      </div>

      <div className="mt-5 min-h-0 overflow-y-auto">
        {videos.error ? (
          <EmptyState>{videos.error}</EmptyState>
        ) : !videos.data ? (
          <ul className="grid grid-cols-4 gap-2" aria-label="Loading">
            {Array.from({ length: 4 }, (_, index) => (
              <li key={index} className="aspect-[3/4] animate-pulse rounded-[6px] bg-black/8" />
            ))}
          </ul>
        ) : videos.data.content.length === 0 ? (
          <EmptyState>No posts yet</EmptyState>
        ) : (
          <ul className="grid grid-cols-4 gap-2">
            {videos.data.content.map((video) => (
              <li key={video.id}>
                <Link
                  href={`/video/${video.id}`}
                  onClick={onPlainClick(() => {
                    onClose();
                    openVideo(
                      video.id,
                      videos.data!.content.map((item) => item.id),
                    );
                  })}
                  className="relative block aspect-[3/4] overflow-hidden rounded-[6px] bg-black/8 hover:opacity-90"
                >
                  {video.thumbnailUrl && (
                    // eslint-disable-next-line @next/next/no-img-element -- CDN thumbnail, as in PostThumb
                    <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  )}
                  <span className="absolute inset-x-0 bottom-0 flex items-center gap-1 bg-gradient-to-t from-black/60 to-transparent px-1.5 pt-4 pb-1 text-[11px] font-semibold text-white">
                    <Play className="h-2.5 w-2.5 fill-current" />
                    {formatCount(video.viewCount)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Modal>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <span>
      <strong className="mr-1 font-semibold text-black">{formatCount(value)}</strong>
      {label}
    </span>
  );
}
