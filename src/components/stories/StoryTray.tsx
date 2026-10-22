"use client";

import { Plus } from "lucide-react";
import { useMemo, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { useStoryFeed } from "@/hooks/use-story-feed";
import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import type { StoryGroup } from "@/lib/api/types";
import { firstUnseen, type StoryPosition } from "@/lib/stories/navigation";
import type { Author } from "@/types/tiktok";

import { StoryComposer } from "./StoryComposer";
import { StoryRing } from "./StoryRing";
import { StoryViewer } from "./StoryViewer";

/**
 * Stories on the Following page: the tray, the player it opens and the composer its "+" opens.
 * `followedIds` is null until the page has read the follow list.
 */
export function StoryBar({ followedIds }: { followedIds: readonly string[] | null }) {
  const { user } = useSession();
  const [open, setOpen] = useState<StoryPosition | null>(null);
  const [composing, setComposing] = useState(false);
  const { groups, profiles, refresh, markSeen } = useStoryFeed(
    followedIds,
    open !== null || composing,
  );
  const authors = useMemo(
    () =>
      Object.fromEntries(
        Object.entries(profiles).map(([userId, profile]) => [userId, authorFromProfile(profile)]),
      ),
    [profiles],
  );

  if (!user) return null;

  // Read again on the way out: the order puts owners with nothing left unseen last, and a verdict
  // may have come in for the viewer's own story meanwhile.
  const close = () => {
    setOpen(null);
    refresh();
  };

  return (
    <>
      <StoryTray
        groups={groups}
        authors={authors}
        onOpen={(index) => setOpen({ group: index, story: firstUnseen(groups[index]) })}
        onCreate={() => setComposing(true)}
      />
      {open && (
        <StoryViewer
          key={`${open.group}:${open.story}`}
          groups={groups}
          authors={authors}
          start={open}
          onClose={close}
          onSeen={markSeen}
          onOwnStoryChanged={refresh}
          onOwnStoryDeleted={close}
        />
      )}
      {composing && (
        <StoryComposer
          onClose={() => setComposing(false)}
          onPosted={() => {
            setComposing(false);
            refresh();
          }}
        />
      )}
    </>
  );
}

/**
 * The row of bubbles above the Following feed. The viewer's own bubble is always first, so there
 * is somewhere to post from even before anyone has a story: with stories of their own it opens
 * them and the "+" posts another; without, the bubble itself posts.
 */
export function StoryTray({
  groups,
  authors,
  onOpen,
  onCreate,
}: {
  groups: readonly StoryGroup[];
  authors: Readonly<Record<string, Author>>;
  onOpen: (groupIndex: number) => void;
  onCreate: () => void;
}) {
  const { user } = useSession();
  if (!user) return null;

  const ownIndex = groups.findIndex((group) => group.userId === user.userId);

  return (
    <nav
      aria-label="Stories"
      className="no-scrollbar flex gap-4 overflow-x-auto px-4 pt-4 pb-2"
    >
      <div className="relative flex w-[72px] shrink-0 flex-col items-center gap-1">
        <button
          type="button"
          onClick={() => (ownIndex === -1 ? onCreate() : onOpen(ownIndex))}
          aria-label={ownIndex === -1 ? "Create a story" : "Your story"}
          className="rounded-full"
        >
          <StoryRing state={ownIndex === -1 ? "none" : "seen"}>
            <Avatar src={user.avatarUrl} />
          </StoryRing>
        </button>
        <button
          type="button"
          onClick={onCreate}
          aria-label="Create a story"
          className="absolute top-[42px] right-[6px] flex h-5 w-5 items-center justify-center rounded-full border-2 border-[var(--tt-page)] bg-[var(--tt-red)] text-white"
        >
          <Plus className="h-3 w-3" strokeWidth={3} />
        </button>
        <span className="w-full truncate text-center text-[12px] leading-4 text-[var(--tt-text-secondary)]">
          Your story
        </span>
      </div>

      {groups.map((group, index) => {
        if (index === ownIndex) return null;
        const author = authors[group.userId] ?? unknownAuthor(group.userId);
        return (
          <button
            key={group.userId}
            type="button"
            onClick={() => onOpen(index)}
            aria-label={`${author.nickname}'s story${group.hasUnseen ? ", new" : ""}`}
            className="flex w-[72px] shrink-0 flex-col items-center gap-1"
          >
            <StoryRing state={group.hasUnseen ? "unseen" : "seen"}>
              <Avatar src={author.avatarUrl} />
            </StoryRing>
            <span className="w-full truncate text-center text-[12px] leading-4 text-[var(--tt-text)]">
              {author.nickname}
            </span>
          </button>
        );
      })}
    </nav>
  );
}

function Avatar({ src }: { src: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline
    <img
      src={src}
      alt=""
      referrerPolicy="no-referrer"
      className="h-14 w-14 rounded-full bg-[rgb(136_136_136/0.5)] object-cover"
    />
  );
}
