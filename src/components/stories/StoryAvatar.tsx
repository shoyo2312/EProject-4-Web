"use client";

import { useRouter } from "next/navigation";
import type { MouseEvent, ReactNode } from "react";

import { DEFAULT_AVATAR } from "@/lib/api/adapters";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

import { useStories, useStoryRing } from "./StoriesProvider";
import { StoryRing } from "./StoryRing";

/**
 * An avatar that opens its owner's stories when they have some the viewer may watch. `children` is
 * the avatar as the page draws it today, usually a link to the profile, and stays exactly that
 * while there is no ring. With one, the ring takes its place as a button: a click plays the
 * stories, and goes to the profile if they turn out to be gone. `className` sizes the button, and
 * the ring fills it.
 */
export function StoryAvatar({
  author,
  className,
  thin,
  children,
}: {
  author: Author;
  className?: string;
  thin?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const state = useStoryRing(author.userId);
  const { openStories } = useStories();

  if (state === "none") return <>{children}</>;

  async function watch(event: MouseEvent) {
    // The avatar often sits in a row that is itself a link, or opens something on click.
    event.preventDefault();
    event.stopPropagation();
    if (!(await openStories(author))) router.push(`/@${author.username}`);
  }

  return (
    <button
      type="button"
      onClick={watch}
      // Rows such as the activity list act on these keys themselves; the button's own click is enough.
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") event.stopPropagation();
      }}
      aria-label={`Watch ${author.nickname}'s stories`}
      className={cn("flex-none rounded-full", className)}
    >
      <StoryRing state={state} thin={thin} fill>
        {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline */}
        <img
          src={author.avatarUrl || DEFAULT_AVATAR}
          alt=""
          referrerPolicy="no-referrer"
          className="h-full w-full rounded-full object-cover"
        />
      </StoryRing>
    </button>
  );
}
