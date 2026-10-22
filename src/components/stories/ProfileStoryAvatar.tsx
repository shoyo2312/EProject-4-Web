"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { getUserStories } from "@/lib/api/stories";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";
import { firstUnseen, markStorySeen } from "@/lib/stories/navigation";
import { ringStateOf } from "@/lib/stories/ring-store";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";

/**
 * A profile's avatar, ringed when its owner has stories the viewer may see, opening them on click.
 * The stories are whatever `GET /stories/users/{id}` answers for this viewer — a guest sees only
 * PUBLIC ones of public accounts, the owner all of theirs with their status — and a failed read is
 * just an avatar without a ring.
 */
export function ProfileStoryAvatar({ author, className }: { author: Author; className?: string }) {
  const { user } = useSession();
  const viewerId = user?.userId ?? null;
  const userId = author.userId;
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);

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
  }, [backendAccount, userId, viewerId, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);
  const markSeen = useCallback(
    (storyId: string) =>
      setStories((current) => markStorySeen([{ userId, stories: current, hasUnseen: true }], storyId)[0].stories),
    [userId],
  );
  const close = useCallback(() => {
    setOpen(false);
    reload();
  }, [reload]);

  // One array per change, not per render: the player's step callbacks, and with them its clock,
  // are rebuilt whenever `groups` changes identity.
  const state = ringStateOf(stories, userId === viewerId);
  const groups = useMemo<StoryGroup[]>(
    () => [{ userId, stories, hasUnseen: state === "unseen" }],
    [userId, stories, state],
  );
  const group = groups[0];

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline
    <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer" className={cn("rounded-full object-cover", className)} />
  );

  if (state === "none") return image;

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Watch ${author.nickname}'s stories`}
        className="flex-none rounded-full">
        <StoryRing state={state}>{image}</StoryRing>
      </button>
      {open && (
        <StoryViewer
          groups={groups}
          authors={{ [userId]: author }}
          start={{ group: 0, story: firstUnseen(group) }}
          onClose={close}
          onSeen={markSeen}
          onOwnStoryChanged={reload}
          onOwnStoryDeleted={close}
        />
      )}
    </>
  );
}
