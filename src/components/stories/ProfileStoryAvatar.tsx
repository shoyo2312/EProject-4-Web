"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { EyeIcon, PlayIcon } from "@/components/icons";
import { AvatarLightbox } from "@/components/profile/AvatarLightbox";
import { useSession } from "@/components/session/SessionProvider";
import { MODAL_EXIT_MS } from "@/components/ui/modal";
import { useDismiss } from "@/hooks/use-dismiss";
import { usePresence } from "@/hooks/use-presence";
import { getUserStories } from "@/lib/api/stories";
import type { StoryGroup, StoryResponse } from "@/lib/api/types";
import { firstUnseen, markStorySeen } from "@/lib/stories/navigation";
import { ringStateOf } from "@/lib/stories/ring-store";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

import { StoryRing } from "./StoryRing";
import { StoryViewer, VIEWER_EXIT_MS } from "./StoryViewer";

/** How long the action menu stays mounted while it fades out. */
const MENU_EXIT_MS = 150;

/**
 * A profile's avatar, ringed when its owner has stories the viewer may see. The owner's own avatar
 * opens them on click; someone else's opens a small menu — view the avatar full size, and watch
 * the stories when there are any. The stories are whatever `GET /stories/users/{id}` answers for
 * this viewer — a guest sees only PUBLIC ones of public accounts, the owner all of theirs with
 * their status — and a failed read is just an avatar without a ring.
 */
export function ProfileStoryAvatar({ author, className }: { author: Author; className?: string }) {
  const { user } = useSession();
  const viewerId = user?.userId ?? null;
  const userId = author.userId;
  const own = userId === viewerId;
  const [stories, setStories] = useState<StoryResponse[]>([]);
  const [open, setOpen] = useState(false);
  const player = usePresence(open, VIEWER_EXIT_MS);
  const [version, setVersion] = useState(0);

  const [menuOpen, setMenuOpen] = useState(false);
  const menu = usePresence(menuOpen, MENU_EXIT_MS);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const lightbox = usePresence(lightboxOpen, MODAL_EXIT_MS);
  const rootRef = useRef<HTMLDivElement>(null);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(rootRef, menuOpen, closeMenu);

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
  const state = ringStateOf(stories, own);
  const groups = useMemo<StoryGroup[]>(
    () => [{ userId, stories, hasUnseen: state === "unseen" }],
    [userId, stories, state],
  );
  const group = groups[0];

  const image = (
    // eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline
    <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer" className={cn("rounded-full object-cover", className)} />
  );
  const pending = own && state !== "unseen" && stories.some((story) => story.status === "PENDING_MODERATION");
  const ringed = state === "none" ? image : <StoryRing state={state} pending={pending}>{image}</StoryRing>;

  const viewer = player.mounted && (
    <StoryViewer
      closing={player.closing}
      groups={groups}
      authors={{ [userId]: author }}
      start={{ group: 0, story: firstUnseen(group) }}
      onClose={close}
      onSeen={markSeen}
      onOwnStoryChanged={reload}
      onOwnStoryDeleted={close}
    />
  );

  if (own) {
    if (state === "none") return image;
    return (
      <>
        <button type="button" onClick={() => setOpen(true)} aria-label={`Watch ${author.nickname}'s stories`}
          className="flex-none rounded-full">
          {ringed}
        </button>
        {viewer}
      </>
    );
  }

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenuOpen((was) => !was)}
        aria-label={`${author.nickname}'s avatar`}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex-none rounded-full"
      >
        {ringed}
      </button>

      {menu.mounted && (
        <div
          role="menu"
          inert={menu.closing || undefined}
          className={cn(
            "absolute top-full left-1/2 z-[101] mt-2 w-36 origin-top -translate-x-1/2 overflow-hidden rounded-[8px] bg-[#252525] shadow-[0_2px_12px_rgba(0,0,0,0.4)]",
            "transition-[opacity,scale] duration-150 ease-out starting:scale-90 starting:opacity-0",
            menu.closing && "scale-90 opacity-0",
          )}
        >
          <MenuItem
            icon={<EyeIcon className="h-5 w-5" />}
            label="View avatar"
            onClick={() => {
              setMenuOpen(false);
              setLightboxOpen(true);
            }}
          />
          {state !== "none" && (
            <MenuItem
              icon={<PlayIcon className="h-5 w-5" />}
              label="View story"
              onClick={() => {
                setMenuOpen(false);
                setOpen(true);
              }}
            />
          )}
        </div>
      )}

      {lightbox.mounted && (
        <AvatarLightbox
          src={author.avatarUrl}
          name={author.nickname}
          closing={lightbox.closing}
          onClose={() => setLightboxOpen(false)}
        />
      )}
      {viewer}
    </div>
  );
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left text-[13px] text-[var(--tt-text)] hover:bg-white/10"
    >
      <span className="text-[var(--tt-icon)]">{icon}</span>
      {label}
    </button>
  );
}
