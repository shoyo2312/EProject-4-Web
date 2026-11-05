"use client";

import { BatteryFull, ChevronLeft, Ellipsis, Music, Plus, Signal, Wifi } from "lucide-react";
import { useRef, useState } from "react";

import {
  BookmarkIcon,
  CommentIcon,
  FriendsOutlineIcon,
  HeartIcon,
  HouseOutlineIcon,
  LikedIcon,
  LiveIcon,
  MessagesIcon,
  PersonIcon,
  PlayIcon,
  ProfileVideosIcon,
  RepostIcon,
  SearchIcon,
  ShareIcon,
} from "@/components/icons";
import { isHlsManifest, useHlsSource } from "@/hooks/use-hls-source";
import type { VideoResponse } from "@/lib/api/types";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";

type Tab = "feed" | "profile" | "web";
const TABS: { value: Tab; label: string }[] = [
  { value: "feed", label: "Feed" },
  { value: "profile", label: "Profile" },
  { value: "web", label: "Web" },
];

/**
 * The column beside TikTok Studio's edit form: the post as viewers will meet it —
 * in the For You feed, on the profile grid, or on the web player — caption as typed.
 */
export function PostPreview({
  video,
  caption,
  username,
  avatarUrl,
}: {
  video: VideoResponse;
  caption: string;
  username: string;
  avatarUrl?: string;
}) {
  const [tab, setTab] = useState<Tab>("feed");

  return (
    <aside className="hidden w-[260px] flex-none lg:block">
      <div className="sticky top-6 flex flex-col gap-3">
        <div role="tablist" className="flex rounded-[8px] bg-black/5 p-1">
          {TABS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={cn(
                "h-7 flex-1 rounded-[6px] text-[14px] transition-colors",
                tab === item.value ? "bg-white font-medium text-black shadow-[0_1px_2px_rgba(0,0,0,0.08)]" : "text-black/65 hover:text-black",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>

        {tab === "feed" && <FeedPhone video={video} caption={caption} username={username} avatarUrl={avatarUrl} />}
        {tab === "profile" && <ProfilePhone video={video} username={username} avatarUrl={avatarUrl} />}
        {tab === "web" && <WebPlayer video={video} caption={caption} username={username} avatarUrl={avatarUrl} />}
      </div>
    </aside>
  );
}

function StatusBar({ dark }: { dark?: boolean }) {
  return (
    <div className={cn("flex items-center justify-between px-5 pt-2.5 text-[11px] font-semibold", dark ? "text-black" : "text-white")}>
      <span>8:00</span>
      <span className="flex items-center gap-1">
        <Signal className="h-3 w-3" strokeWidth={3} />
        <Wifi className="h-3 w-3" strokeWidth={3} />
        <BatteryFull className="h-3.5 w-3.5" />
      </span>
    </div>
  );
}

function Avatar({ src, className }: { src?: string; className?: string }) {
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- the viewer's own avatar, any host user-service allowed
    <img src={src} alt="" referrerPolicy="no-referrer" className={cn("rounded-full object-cover", className)} />
  ) : (
    <span className={cn("block rounded-full bg-white/30", className)} />
  );
}

function PreviewVideo({ video, className }: { video: VideoResponse; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  // A manifest is attached by the hook, as the feed's cards do; a plain file plays from `src`.
  useHlsSource(ref, video.hlsUrl ?? "");
  return (
    <video
      ref={ref}
      src={video.hlsUrl && !isHlsManifest(video.hlsUrl) ? video.hlsUrl : undefined}
      poster={video.thumbnailUrl ?? undefined}
      muted
      loop
      autoPlay
      playsInline
      className={cn("object-contain", className)}
    />
  );
}

/** The For You screen: status bar, Following / For You, the action rail, caption, tab bar. */
function FeedPhone({
  video,
  caption,
  username,
  avatarUrl,
}: {
  video: VideoResponse;
  caption: string;
  username: string;
  avatarUrl?: string;
}) {
  return (
    <div className="relative h-[560px] overflow-hidden rounded-[16px] bg-black text-white">
      <PreviewVideo video={video} className="absolute inset-x-0 top-0 bottom-12 h-[calc(100%-48px)] w-full" />

      <div className="absolute inset-x-0 top-0">
        <StatusBar />
        <div className="mt-2 flex items-center justify-between px-3">
          <LiveIcon className="h-5 w-5" />
          <div className="flex items-center gap-4 text-[13px]">
            <span className="text-white/65">Following</span>
            <span className="relative font-semibold">
              For You
              <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-white" />
            </span>
          </div>
          <SearchIcon className="h-4 w-4" />
        </div>
      </div>

      <div className="absolute right-2 bottom-16 flex flex-col items-center gap-2.5">
        <span className="relative mb-1">
          <Avatar src={avatarUrl} className="h-8 w-8 border border-white" />
          <span className="absolute -bottom-1.5 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-[#fe2c55]">
            <Plus className="h-2.5 w-2.5" strokeWidth={4} />
          </span>
        </span>
        {[HeartIcon, CommentIcon, BookmarkIcon, ShareIcon].map((Icon, index) => (
          <span key={index} className="flex flex-col items-center text-[9px] leading-3">
            <Icon className="h-6 w-6" />…
          </span>
        ))}
        <span className="mt-1 flex h-7 w-7 animate-spin items-center justify-center rounded-full bg-neutral-800 [animation-duration:4s] motion-reduce:animate-none">
          <Avatar src={avatarUrl} className="h-4 w-4" />
        </span>
      </div>

      <div className="absolute right-12 bottom-14 left-3 text-[11px] leading-[14px]">
        <p className="text-[12px] font-semibold">{username}</p>
        <p className="mt-0.5 line-clamp-2 break-words">{caption}</p>
        <p className="mt-1 flex items-center gap-1 truncate">
          <Music className="h-3 w-3 flex-none" />
          original sound - {username}
        </p>
      </div>

      <nav className="absolute inset-x-0 bottom-0 flex h-12 items-center justify-around bg-black pb-1 text-[8px]">
        <TabBarItem icon={<HouseOutlineIcon className="h-5 w-5" />} label="Home" active />
        <TabBarItem icon={<FriendsOutlineIcon className="h-5 w-5" />} label="Friends" />
        <span className="flex h-6 w-9 items-center justify-center rounded-[7px] bg-white text-black shadow-[-3px_0_0_#25f4ee,3px_0_0_#fe2c55]">
          <Plus className="h-4 w-4" strokeWidth={3} />
        </span>
        <TabBarItem icon={<MessagesIcon className="h-5 w-5" />} label="Inbox" />
        <TabBarItem icon={<PersonIcon className="h-5 w-5" />} label="Me" />
      </nav>
    </div>
  );
}

function TabBarItem({ icon, label, active }: { icon: React.ReactNode; label: string; active?: boolean }) {
  return (
    <span className={cn("flex flex-col items-center gap-0.5", active ? "text-white" : "text-white/65")}>
      {icon}
      {label}
    </span>
  );
}

/** The owner's profile grid with this post in the first tile; the rest are placeholders. */
function ProfilePhone({ video, username, avatarUrl }: { video: VideoResponse; username: string; avatarUrl?: string }) {
  return (
    <div className="h-[560px] overflow-hidden rounded-[16px] border border-black/12 bg-white text-black">
      <StatusBar dark />
      <div className="flex items-center justify-between px-3 pt-2">
        <ChevronLeft className="h-5 w-5" />
        <Ellipsis className="h-5 w-5" />
      </div>
      <div className="flex flex-col items-center gap-1.5">
        <Avatar src={avatarUrl} className="h-16 w-16 bg-black/8" />
        <p className="text-[12px] font-semibold">{username}</p>
        <span className="mt-1 h-4 w-28 rounded-[4px] bg-black/5" />
        <span className="flex gap-1.5">
          <span className="h-6 w-20 rounded-[4px] bg-black/5" />
          <span className="h-6 w-20 rounded-[4px] bg-black/5" />
        </span>
      </div>
      <div className="mt-4 grid grid-cols-3 border-b border-black/8 text-black/34">
        <span className="flex justify-center border-b-2 border-black pb-2 text-black">
          <ProfileVideosIcon className="h-4 w-4" />
        </span>
        <span className="flex justify-center pb-2">
          <RepostIcon className="h-4 w-4" />
        </span>
        <span className="flex justify-center pb-2">
          <LikedIcon className="h-4 w-4" />
        </span>
      </div>
      <div className="grid grid-cols-3 gap-px">
        <div className="relative aspect-[3/4] bg-black">
          {video.thumbnailUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a signed MinIO URL, any host
            <img src={video.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          )}
          <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[9px] font-semibold text-white">
            <PlayIcon className="h-2.5 w-2.5" />
            {formatCount(video.viewCount)}
          </span>
        </div>
        {Array.from({ length: 8 }, (_, index) => (
          <span key={index} className="aspect-[3/4] bg-black/5" />
        ))}
      </div>
    </div>
  );
}

/** tiktok.com's player: the post letterboxed in a wide frame, caption and rail laid over it. */
function WebPlayer({
  video,
  caption,
  username,
  avatarUrl,
}: {
  video: VideoResponse;
  caption: string;
  username: string;
  avatarUrl?: string;
}) {
  return (
    <div className="relative aspect-video overflow-hidden rounded-[4px] bg-black text-white">
      <PreviewVideo video={video} className="h-full w-full" />
      <div className="absolute right-8 bottom-2 left-2 text-[8px] leading-[10px]">
        <p className="font-semibold">{username}</p>
        <p className="truncate">{caption}</p>
      </div>
      <div className="absolute top-1/2 right-1.5 flex -translate-y-1/2 flex-col items-center gap-1.5">
        <Avatar src={avatarUrl} className="h-4 w-4" />
        {[HeartIcon, CommentIcon, BookmarkIcon, ShareIcon].map((Icon, index) => (
          <Icon key={index} className="h-3 w-3" />
        ))}
      </div>
    </div>
  );
}
