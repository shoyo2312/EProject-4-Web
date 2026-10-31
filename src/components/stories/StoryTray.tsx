"use client";

import { Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { MODAL_EXIT_MS } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { usePresence } from "@/hooks/use-presence";
import { useStoryFeed } from "@/hooks/use-story-feed";
import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import type { StoryGroup } from "@/lib/api/types";
import { awaitingReview, firstUnseen, type StoryPosition } from "@/lib/stories/navigation";
import { ringStateOf } from "@/lib/stories/ring-store";
import { decidedSince } from "@/lib/stories/verdicts";
import type { Author } from "@/types/tiktok";

import { useStories } from "./StoriesProvider";
import { StoryComposer } from "./StoryComposer";
import { StoryRing } from "./StoryRing";
import { StoryViewer, VIEWER_EXIT_MS } from "./StoryViewer";

/** How long the own bubble's pop plays. */
const POP_MS = 600;
/** Every bubble that opens stories lifts a little under the pointer. */
const BUBBLE = "rounded-full motion-safe:transition-transform duration-150 hover:scale-105";

/**
 * Stories on the Following page: the tray, the player it opens and the composer its "+" opens.
 * `followedIds` is null until the page has read the follow list.
 */
export function StoryBar({ followedIds }: { followedIds: readonly string[] | null }) {
  const { user } = useSession();
  const { invalidateOwnRing } = useStories();
  const [open, setOpen] = useState<StoryPosition | null>(null);
  const player = usePresence(open !== null, VIEWER_EXIT_MS);
  // Where the player was: it is still drawn, closing, after `open` is cleared.
  const [lastOpen, setLastOpen] = useState<StoryPosition | null>(null);
  if (open && open !== lastOpen) setLastOpen(open);
  // The groups the closing frame plays: `close()` refreshes the feed, and a read landing inside the
  // exit re-sorts the live groups under the player, onto a story that was never watched.
  const [frozen, setFrozen] = useState<readonly StoryGroup[] | null>(null);
  const [composing, setComposing] = useState(false);
  const composer = usePresence(composing, MODAL_EXIT_MS);
  // The own bubble's one-shot pop: after a post, and when a story of theirs goes live.
  const [popping, setPopping] = useState(false);
  const pop = useCallback(() => setPopping(true), []);
  useEffect(() => {
    if (!popping) return;
    const timer = window.setTimeout(() => setPopping(false), POP_MS);
    return () => window.clearTimeout(timer);
  }, [popping]);
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

  // The tray asks again while the viewer's own story waits for its verdict. When that stops, their
  // ring elsewhere is asked about again too: it turns red once the story is live, instead of
  // waiting out its cache until something re-subscribes.
  const awaiting = user !== null && awaitingReview(groups, user.userId);
  const wasAwaiting = useRef(false);
  useEffect(() => {
    if (wasAwaiting.current && !awaiting) invalidateOwnRing();
    wasAwaiting.current = awaiting;
  }, [awaiting, invalidateOwnRing]);

  // The poster hears each verdict as it lands: compared read against read, by story id, so a second
  // story still in review neither hides the first's verdict nor repeats it.
  const previousGroups = useRef(groups);
  useEffect(() => {
    const previous = previousGroups.current;
    previousGroups.current = groups;
    if (!user || previous === groups) return;
    const { live, hidden } = decidedSince(previous, groups, user.userId);
    if (live.length > 0) {
      toast.success("Your story is live");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- a one-shot cue for a verdict that just arrived by poll, not a render-derived value
      pop();
    }
    if (hidden.length > 0) {
      const ownIndex = groups.findIndex((group) => group.userId === user.userId);
      const storyIndex = groups[ownIndex]?.stories.findIndex((story) => story.id === hidden[0].id) ?? -1;
      toast.warning("Your story couldn't be shown", {
        action: {
          label: "See why",
          onClick: () => setOpen({ group: ownIndex, story: Math.max(storyIndex, 0) }),
        },
      });
    }
  }, [groups, user, pop]);

  if (!user) return null;

  // Read again on the way out: the order puts owners with nothing left unseen last, and a verdict
  // may have come in for the viewer's own story meanwhile.
  const close = () => {
    setFrozen(groups);
    setOpen(null);
    refresh();
  };

  return (
    <>
      <StoryTray
        groups={groups}
        authors={authors}
        popping={popping}
        onOpen={(index) => setOpen({ group: index, story: firstUnseen(groups[index]) })}
        onCreate={() => setComposing(true)}
      />
      {player.mounted && lastOpen && (
        <StoryViewer
          key={`${lastOpen.group}:${lastOpen.story}`}
          groups={open ? groups : (frozen ?? groups)}
          authors={authors}
          start={lastOpen}
          closing={player.closing}
          onClose={close}
          onSeen={markSeen}
          onOwnStoryChanged={refresh}
          onOwnStoryDeleted={close}
        />
      )}
      {composer.mounted && (
        <StoryComposer
          closing={composer.closing}
          onClose={() => setComposing(false)}
          onPosted={() => {
            refresh();
            pop();
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
  popping = false,
  onOpen,
  onCreate,
}: {
  groups: readonly StoryGroup[];
  authors: Readonly<Record<string, Author>>;
  /** Plays the own bubble's pop once. */
  popping?: boolean;
  onOpen: (groupIndex: number) => void;
  onCreate: () => void;
}) {
  const { user } = useSession();
  if (!user) return null;

  const ownIndex = groups.findIndex((group) => group.userId === user.userId);
  // Red while a story of theirs is live, grey while the only ones are in review, held or rejected.
  const ownState = ownIndex === -1 ? "none" : ringStateOf(groups[ownIndex].stories, true);
  // The dash turns while nothing of theirs is live yet and a verdict is still to come.
  const ownPending = ownState !== "unseen" && awaitingReview(groups, user.userId);

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
          className={BUBBLE}
        >
          <StoryRing state={ownState} spin pending={ownPending} pop={popping}>
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
            className={`flex w-[72px] shrink-0 flex-col items-center gap-1 ${BUBBLE}`}
          >
            <StoryRing state={group.hasUnseen ? "unseen" : "seen"} spin>
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
