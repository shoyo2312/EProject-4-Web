"use client";

import {
  BatteryFull,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  Ellipsis,
  Forward,
  Grid3x3,
  Heart,
  HeartOff,
  House,
  MessageCircle,
  MessageSquareText,
  Music,
  Play,
  Plus,
  Repeat2,
  Search,
  Signal,
  Tv,
  User,
  Users,
  Wifi,
} from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

const MODES = ["Feed", "Profile", "Web"] as const;
type Mode = (typeof MODES)[number];

interface Author {
  name: string;
  avatarUrl: string;
}

/**
 * The right-hand column of the live upload page: a 244×36 segmented control
 * (6px radius, `rgba(0,0,0,.05)`, 4px inset, white active pill) over a 288px
 * preview. Feed and Profile are a 288×622 phone with a 20px radius; Web is a
 * 16:9 player. The live Edit / Sound / Text buttons under it are left out.
 */
export function Preview({
  url,
  caption,
  author,
}: {
  url: string;
  caption: string;
  author: Author;
}) {
  const [mode, setMode] = useState<Mode>("Feed");

  return (
    <div>
      <div role="tablist" aria-label="Preview" className="flex h-9 w-[244px] rounded-[6px] bg-black/5 p-1">
        {MODES.map((name) => (
          <button
            key={name}
            type="button"
            role="tab"
            aria-selected={mode === name}
            onClick={() => setMode(name)}
            className={cn(
              "flex-1 rounded-[4px] text-[14px] leading-[18px] font-medium transition-colors",
              mode === name ? "bg-white text-black" : "text-black/48 hover:text-black/65",
            )}
          >
            {name}
          </button>
        ))}
      </div>

      <div className="mt-4">
        {mode === "Feed" && <FeedPreview url={url} caption={caption} author={author} />}
        {mode === "Profile" && <ProfilePreview url={url} author={author} />}
        {mode === "Web" && <WebPreview url={url} caption={caption} author={author} />}
      </div>
    </div>
  );
}

function Phone({ light, children }: { light?: boolean; children: React.ReactNode }) {
  return (
    <div className="relative h-[622px] w-[288px] rounded-[20px] bg-black p-[3px]">
      <div className={cn("relative h-full overflow-hidden rounded-[17px]", light ? "bg-white" : "bg-[#161823]")}>
        <div
          className={cn(
            "absolute inset-x-0 top-0 z-10 flex h-8 items-center justify-between px-6 text-[12px] font-semibold",
            light ? "text-black" : "text-white",
          )}
        >
          8:00
          <span className="flex items-center gap-1">
            <Signal className="h-3 w-3" strokeWidth={3} />
            <Wifi className="h-3 w-3" strokeWidth={3} />
            <BatteryFull className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}

/** Plays muted on a loop like the live preview; a click pauses it. */
function Clip({ url, className }: { url: string; className?: string }) {
  return (
    <video
      src={url}
      autoPlay
      muted
      loop
      playsInline
      onClick={(event) => (event.currentTarget.paused ? event.currentTarget.play() : event.currentTarget.pause())}
      className={cn("h-full w-full object-contain", className)}
    />
  );
}

function Rail({ author, small }: { author: Author; small?: boolean }) {
  const icon = small ? "h-3 w-3" : "h-6 w-6";
  return (
    <div className={cn("flex flex-col items-center text-white", small ? "gap-1.5" : "gap-3")}>
      <span className="relative mb-1">
        {/* eslint-disable-next-line @next/next/no-img-element -- the uploader's own avatar, any host user-service allowed */}
        <img
          src={author.avatarUrl}
          alt=""
          referrerPolicy="no-referrer"
          className={cn("rounded-full border border-white object-cover", small ? "h-4 w-4" : "h-[34px] w-[34px]")}
        />
        {!small && (
          <span className="absolute -bottom-1.5 left-1/2 flex h-3.5 w-3.5 -translate-x-1/2 items-center justify-center rounded-full bg-[#fe2c55]">
            <Plus className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
        )}
      </span>
      {[Heart, MessageCircle, Bookmark, Forward].map((Icon, index) => (
        <span key={index} className="flex flex-col items-center text-[8px] leading-[10px]">
          <Icon className={icon} fill="currentColor" strokeWidth={1} />
          {!small && "…"}
        </span>
      ))}
    </div>
  );
}

function FeedPreview({ url, caption, author }: { url: string; caption: string; author: Author }) {
  return (
    <Phone>
      <Clip url={url} className="absolute inset-x-0 top-0 h-[calc(100%-46px)] object-cover" />

      <div className="pointer-events-none absolute inset-x-0 top-8 flex h-9 items-center justify-between px-3 text-white">
        <Tv className="h-4 w-4" strokeWidth={2} />
        <span className="flex gap-4 text-[12px] font-semibold">
          <span className="text-white/70">Following</span>
          <span className="relative">
            For You
            <span className="absolute -bottom-1.5 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-white" />
          </span>
        </span>
        <Search className="h-4 w-4" strokeWidth={2.25} />
      </div>

      <div className="pointer-events-none absolute right-2 bottom-[60px]">
        <Rail author={author} />
        <span className="mt-3 block h-7 w-7 rounded-full border-[6px] border-[#2f2f2f] bg-[#555]" />
      </div>

      <div className="pointer-events-none absolute bottom-[56px] left-2 w-[200px] text-white">
        <p className="text-[12px] leading-4 font-bold">{author.name}</p>
        <p className="mt-0.5 line-clamp-2 text-[10px] leading-[13px] break-words">{caption}</p>
        <p className="mt-1 flex items-center gap-1 truncate text-[10px] leading-[13px]">
          <Music className="h-2.5 w-2.5 flex-none" strokeWidth={2.5} />
          Original sound - {author.name}
        </p>
      </div>

      <nav className="pointer-events-none absolute inset-x-0 bottom-0 flex h-[46px] items-center justify-around bg-black pb-1 text-[8px] text-white/70">
        {[
          { icon: House, label: "Home", on: true },
          { icon: Users, label: "Friends" },
          null,
          { icon: MessageSquareText, label: "Inbox" },
          { icon: User, label: "Me" },
        ].map((item, index) =>
          item ? (
            <span key={item.label} className={cn("flex flex-col items-center gap-0.5", item.on && "text-white")}>
              <item.icon className="h-4 w-4" fill={item.on ? "currentColor" : "none"} strokeWidth={2} />
              {item.label}
            </span>
          ) : (
            <span
              key={index}
              className="flex h-5 w-8 items-center justify-center rounded-[6px] bg-white text-black shadow-[-2px_0_0_#25f4ee,2px_0_0_#fe2c55]"
            >
              <Plus className="h-3.5 w-3.5" strokeWidth={3} />
            </span>
          ),
        )}
      </nav>
    </Phone>
  );
}

function ProfilePreview({ url, author }: { url: string; author: Author }) {
  return (
    <Phone light>
      <div className="flex h-full flex-col pt-8">
        <div className="flex h-8 items-center justify-between px-3">
          <ChevronLeft className="h-4 w-4" strokeWidth={2.25} />
          <Ellipsis className="h-4 w-4" strokeWidth={2.25} />
        </div>

        <div className="flex flex-col items-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- the uploader's own avatar, any host user-service allowed */}
          <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer" className="h-16 w-16 rounded-full object-cover" />
          <p className="mt-1.5 text-[11px] leading-[14px] font-semibold">{author.name}</p>
          <span className="mt-2 h-3 w-[150px] rounded-[3px] bg-black/8" />
          <span className="mt-1.5 flex gap-1.5">
            <span className="h-3 w-[72px] rounded-[3px] bg-black/8" />
            <span className="h-3 w-[72px] rounded-[3px] bg-black/8" />
          </span>
        </div>

        <div className="mt-4 flex h-7 items-stretch border-b border-black/8 text-black/48">
          <span className="flex flex-1 items-center justify-center gap-0.5 border-b-2 border-black text-black">
            <Grid3x3 className="h-3.5 w-3.5" strokeWidth={2} />
            <ChevronDown className="h-2.5 w-2.5" strokeWidth={3} />
          </span>
          <span className="flex flex-1 items-center justify-center">
            <Repeat2 className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          <span className="flex flex-1 items-center justify-center">
            <HeartOff className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
        </div>

        <div className="grid grid-cols-3 gap-px">
          <div className="relative aspect-[3/4] bg-black">
            <video src={`${url}#t=0.1`} muted playsInline preload="metadata" className="h-full w-full object-cover" />
            <span className="absolute bottom-1 left-1 flex items-center gap-0.5 text-[8px] font-semibold text-white">
              <Play className="h-2 w-2" fill="currentColor" />0
            </span>
          </div>
          {Array.from({ length: 11 }, (_, index) => (
            <div key={index} className="aspect-[3/4] bg-black/5" />
          ))}
        </div>
      </div>
    </Phone>
  );
}

function WebPreview({ url, caption, author }: { url: string; caption: string; author: Author }) {
  return (
    <div className="relative aspect-video w-[288px] overflow-hidden rounded-[8px] bg-black">
      <Clip url={url} />
      <div className="pointer-events-none absolute top-1/2 right-1.5 -translate-y-1/2">
        <Rail author={author} small />
      </div>
      <div className="pointer-events-none absolute bottom-2 left-2.5 w-[180px] text-white">
        <p className="text-[8px] leading-[10px] font-bold">{author.name}</p>
        <p className="truncate text-[7px] leading-[9px]">{caption}</p>
      </div>
    </div>
  );
}
