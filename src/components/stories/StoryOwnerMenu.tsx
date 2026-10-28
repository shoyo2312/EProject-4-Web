"use client";

import { Check } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { MoreHorizontalIcon } from "@/components/icons";
import { MODAL_EXIT_MS, modalCardMotion, modalOverlayMotion } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useDismiss } from "@/hooks/use-dismiss";
import { useEscapeKey } from "@/hooks/use-escape-key";
import { useFocusTrap } from "@/hooks/use-focus-trap";
import { usePresence } from "@/hooks/use-presence";
import { messageFor } from "@/lib/api/errors";
import { deleteStory, updateStoryVisibility } from "@/lib/api/stories";
import type { StoryResponse, StoryVisibility } from "@/lib/api/types";
import { cn } from "@/lib/utils";

import { useStories } from "./StoriesProvider";

/** How long the menu stays mounted while it fades out. */
const MENU_EXIT_MS = 150;

const AUDIENCES: readonly { value: StoryVisibility; label: string }[] = [
  { value: "PUBLIC", label: "Everyone" },
  { value: "FRIENDS", label: "Friends" },
  { value: "PRIVATE", label: "Only you" },
];

/**
 * The ⋯ beside mute on the owner's own story: who can see it, and a way to take it down behind a
 * confirmation. `onBusy` holds the player while the menu or the confirmation is open.
 */
export function StoryOwnerMenu({
  story,
  onChanged,
  onDeleted,
  onBusy,
}: {
  story: StoryResponse;
  onChanged: () => void;
  onDeleted: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const { invalidateOwnRing } = useStories();
  const rootRef = useRef<HTMLDivElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menu = usePresence(menuOpen, MENU_EXIT_MS);
  const [confirming, setConfirming] = useState(false);
  const confirm = usePresence(confirming, MODAL_EXIT_MS);
  // Shown at once; the player's copy of the story catches up when `onChanged` reloads it.
  const [visibility, setVisibility] = useState(story.visibility);

  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(rootRef, menuOpen, closeMenu);

  const busy = menuOpen || confirming;
  const onBusyRef = useRef(onBusy);
  useEffect(() => {
    onBusyRef.current = onBusy;
  });
  useEffect(() => {
    onBusyRef.current(busy);
  }, [busy]);

  async function choose(next: StoryVisibility) {
    const before = visibility;
    setVisibility(next);
    setMenuOpen(false);
    try {
      await updateStoryVisibility(story.id, next);
      onChanged();
    } catch (caught) {
      setVisibility(before);
      toast.error(messageFor(caught, "Couldn’t change who can see this story."));
    }
  }

  async function remove() {
    try {
      await deleteStory(story.id);
      invalidateOwnRing();
      setConfirming(false);
      onDeleted();
    } catch (caught) {
      setConfirming(false);
      toast.error(messageFor(caught, "Couldn’t delete this story."));
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setMenuOpen((was) => !was)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="rounded-full p-1 hover:bg-white/10"
      >
        <MoreHorizontalIcon className="h-5 w-5" />
      </button>

      {menu.mounted && (
        <div
          role="menu"
          inert={menu.closing || undefined}
          className={cn(
            "absolute top-full right-0 z-30 mt-2 w-52 origin-top-right overflow-hidden rounded-[8px] bg-[#252525] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]",
            "transition-[opacity,scale] duration-150 ease-out starting:scale-90 starting:opacity-0",
            menu.closing && "scale-90 opacity-0",
          )}
        >
          <p className="px-4 pt-2 pb-1 text-[12px] font-semibold text-white/60">Who can see this story</p>
          {AUDIENCES.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={visibility === value}
              onClick={() => void choose(value)}
              className="flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-[14px] text-[var(--tt-text)] hover:bg-white/10"
            >
              {label}
              {visibility === value && <Check className="h-4 w-4" />}
            </button>
          ))}
          <div className="my-1 border-t border-white/10" />
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setConfirming(true);
            }}
            className="flex w-full cursor-pointer px-4 py-2.5 text-left text-[14px] font-semibold text-[var(--tt-red)] hover:bg-white/10"
          >
            Delete story
          </button>
        </div>
      )}

      {confirm.mounted && (
        <DeleteStoryConfirm closing={confirm.closing} onCancel={() => setConfirming(false)} onConfirm={() => void remove()} />
      )}
    </div>
  );
}

/** The live `Button` at `size: "small"`, as `LogoutConfirmModal` draws it. */
const BUTTON =
  "flex h-12 flex-1 items-center justify-center rounded-[4px] border bg-white/[0.08] px-2.5 text-[16px] leading-[22px] font-semibold select-none focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[rgb(255_76_58)]";

/** "Delete this story?" over the player, with the house modal motion in and out. */
function DeleteStoryConfirm({
  closing,
  onCancel,
  onConfirm,
}: {
  closing: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  useEscapeKey(onCancel, !closing);
  useFocusTrap(dialogRef, !closing);

  return createPortal(
    <div
      inert={closing || undefined}
      className={cn("fixed inset-0 z-[3002] flex items-center justify-center", modalOverlayMotion(closing))}
    >
      <button type="button" aria-label="Cancel" onClick={onCancel} className="absolute inset-0 cursor-default bg-black/[0.68]" />
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn(
          "relative flex w-[400px] max-w-[calc(100vw-2rem)] flex-col items-center rounded-[8px] bg-[#252525] p-8 shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
          modalCardMotion(closing),
        )}
      >
        <h2 id={titleId} className="w-full text-center text-[24px] leading-[30px] font-bold text-[var(--tt-text)]">
          Delete this story?
        </h2>
        <p className="mt-2 text-center text-[14px] leading-5 text-[var(--tt-text-secondary)]">
          It will be removed for everyone. This can’t be undone.
        </p>
        <div className="mt-6 flex w-full gap-2">
          <button
            type="button"
            onClick={onCancel}
            className={cn(BUTTON, "border-transparent text-[var(--tt-text)] hover:border-[rgb(208_209_211)] hover:bg-[#121212]")}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={cn(BUTTON, "border-[var(--tt-red-active)] text-[var(--tt-red-active)] hover:bg-[rgb(254_44_85/0.06)] active:bg-[rgb(254_44_85/0.16)]")}
          >
            Delete
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
