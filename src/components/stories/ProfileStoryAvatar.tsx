"use client";

import { useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { getUserStories } from "@/lib/api/stories";
import type { StoryResponse } from "@/lib/api/types";
import { markStorySeen } from "@/lib/stories/navigation";
import { cn } from "@/lib/utils";

import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";

/**
 * A profile's avatar, ringed when its owner has stories the viewer may see, opening them on click.
 * The stories are whatever `GET /stories/users/{id}` answers for this viewer — a guest sees only
 * PUBLIC ones of public accounts — and a failed read is just an avatar without a ring.
 */
export function ProfileStoryAvatar({
  userId,
  avatarUrl,
  className,
}: {
  userId: string;
  avatarUrl: string;
  className?: string;
}) {
  const { user } = useSession();
  const viewerId = user?.userId ?? null;
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [open, setOpen] = useState(false);

  // Only backend accounts have stories; the template's static profiles carry other ids.
  const backendAccount = /^\d+$/.test(userId);

  useEffect(() => {
    if (!backendAccount) return;
    let cancelled = false;
    getUserStories(userId)
      .then((loaded) => {
        if (!cancelled) setStories(loaded);
      })
      .catch(() => {
        if (!cancelled) setStories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [backendAccount, userId, viewerId]);

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline
    <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className={cn("rounded-full object-cover", className)} />
  );

  if (stories.length === 0) return image;

  const own = userId === viewerId;
  const unseen = !own && stories.some((story) => !story.viewedByMe);
  const groups = [{ userId, stories, hasUnseen: unseen }];

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Watch stories" className="flex-none rounded-full">
        <StoryRing state={unseen ? "unseen" : "seen"}>{image}</StoryRing>
      </button>
      {open && (
        <StoryViewer
          groups={groups}
          profiles={{}}
          start={{ group: 0, story: Math.max(0, stories.findIndex((story) => !story.viewedByMe)) }}
          viewerId={viewerId}
          onClose={() => setOpen(false)}
          onSeen={(storyId) => setStories((current) => markStorySeen([{ userId, stories: current, hasUnseen: true }], storyId)[0].stories)}
        />
      )}
    </>
  );
}
