"use client";

import { useRouter } from "next/navigation";
import { useState, type MouseEvent, type ReactNode } from "react";

import { useStories, useStoryRing } from "@/components/stories/StoriesProvider";
import { StoryRing } from "@/components/stories/StoryRing";
import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { cn } from "@/lib/utils";

/**
 * A round avatar that always draws something: the account's picture, then the default one if that
 * fails to load, then a plain tinted circle if even that is missing. Remote avatars can be any CDN
 * URL the account set, so a broken image is routine rather than exceptional.
 */
export function ChatAvatar({
  src,
  userId,
  name,
  className,
}: {
  src: string | undefined;
  userId?: string;
  /** The account's display name, for the story button's label. */
  name?: string;
  className?: string;
}) {
  const ring = useStoryRing(userId ?? "");
  const [failed, setFailed] = useState<readonly string[]>([]);
  const shown = [src ?? DEFAULT_AVATAR, DEFAULT_AVATAR].find((candidate) => !failed.includes(candidate));
  const base = "flex-none rounded-full bg-[var(--tt-field)]";
  const imageSize = ring === "none" ? className : "h-full w-full";

  const image = shown ? (
    // eslint-disable-next-line @next/next/no-img-element -- the avatar can be any CDN URL the account set; next/image would need each host allow-listed
    <img
      src={shown}
      alt=""
      referrerPolicy="no-referrer"
      onError={() => setFailed((current) => [...current, shown])}
      className={cn(base, "object-cover", imageSize)}
    />
  ) : <span aria-hidden className={cn(base, imageSize)} />;

  if (ring === "none") return image;

  return (
    <WatchableRing userId={userId ?? ""} name={name} avatarUrl={shown} className={className}>
      <StoryRing state={ring} fill>
        {image}
      </StoryRing>
    </WatchableRing>
  );
}

/**
 * The ringed avatar as a button that plays the owner's stories right where it is; if they turn out
 * to be gone it goes to the profile instead. Apart from `ChatAvatar` because `useRouter` throws
 * outside an app router, and an avatar with no ring must not need one.
 */
function WatchableRing({
  userId,
  name,
  avatarUrl,
  className,
  children,
}: {
  userId: string;
  name?: string;
  avatarUrl: string | undefined;
  className?: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { openStories } = useStories();
  const nickname = name ?? "this account";

  async function watch(event: MouseEvent) {
    // The avatar sits inside a conversation link or a profile link: the click is for the stories.
    event.preventDefault();
    event.stopPropagation();
    const opened = await openStories({ userId, username: userId, nickname, avatarUrl: avatarUrl ?? DEFAULT_AVATAR });
    if (!opened) router.push(`/@${userId}`);
  }

  return (
    <button
      type="button"
      onClick={watch}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
      aria-label={`Watch ${nickname}'s stories`}
      className={cn("inline-flex flex-none rounded-full", className)}
    >
      {children}
    </button>
  );
}
