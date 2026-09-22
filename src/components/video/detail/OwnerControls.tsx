"use client";

import { useCallback, useRef, useState } from "react";

import { Trash2 } from "lucide-react";

import { EyeOffIcon, MoreIcon } from "@/components/icons";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { useDismiss } from "@/hooks/use-dismiss";
import type { VideoVisibility } from "@/lib/api/types";
import {
  deleteVideo,
  updateVideoCommentsSetting,
  updateVideoVisibility,
} from "@/lib/api/videos";
import { cn } from "@/lib/utils";

/**
 * The owner's own control on the author row, in place of Follow — modelled on
 * the live TikTok video page: a "…" button opening a two-item menu.
 *
 *   Privacy settings  →  a modal with a "Who can watch this video" select
 *                        (Everyone→PUBLIC, Friends→FRIENDS, Only you→PRIVATE)
 *                        and an "Allow comments" toggle. Both edit drafts only;
 *                        each changed one is sent when "Done" is clicked.
 *   Delete            →  a confirm modal, then `DELETE /videos/{id}` and the
 *                        overlay closes.
 */
export function OwnerControls({
  videoId,
  initialVisibility,
  initialCommentsDisabled,
  onDeleted,
}: {
  videoId: string;
  initialVisibility?: VideoVisibility;
  initialCommentsDisabled?: boolean;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [dialog, setDialog] = useState<null | "privacy" | "delete">(null);
  // Committed values vs. the drafts the modal edits; each changed draft is sent
  // on "Done".
  const [visibility, setVisibility] = useState<VideoVisibility>(
    initialVisibility ?? "PUBLIC",
  );
  const [draftVisibility, setDraftVisibility] = useState(visibility);
  const [commentsOff, setCommentsOff] = useState(
    Boolean(initialCommentsDisabled),
  );
  const [draftCommentsOff, setDraftCommentsOff] = useState(commentsOff);
  const [savingSettings, setSavingSettings] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Click-outside / Escape dismiss, as every other popover on this page does.
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  useDismiss(rootRef, menuOpen, closeMenu);

  // Sent only when "Done" is clicked — one request per changed setting.
  const saveSettings = () => {
    const jobs: Promise<unknown>[] = [];
    if (draftVisibility !== visibility) {
      jobs.push(
        updateVideoVisibility(videoId, draftVisibility).then(() =>
          setVisibility(draftVisibility),
        ),
      );
    }
    if (draftCommentsOff !== commentsOff) {
      jobs.push(
        updateVideoCommentsSetting(videoId, draftCommentsOff).then(() =>
          setCommentsOff(draftCommentsOff),
        ),
      );
    }
    if (jobs.length === 0) {
      setDialog(null);
      return;
    }
    setSavingSettings(true);
    Promise.all(jobs)
      .then(() => {
        setDialog(null);
        toast.success("Settings updated.");
      })
      .catch(() => toast.error("Couldn’t update settings. Please try again."))
      .finally(() => setSavingSettings(false));
  };

  const confirmDelete = () => {
    setDeleting(true);
    deleteVideo(videoId)
      .then(() => {
        toast.success("Video deleted.");
        onDeleted();
      })
      .catch(() => {
        setDeleting(false);
        toast.error("Couldn’t delete the video. Please try again.");
      });
  };

  return (
    <div ref={rootRef} className="relative flex-none">
      <button
        type="button"
        onClick={() => setMenuOpen((open) => !open)}
        aria-label="More"
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        className="flex h-8 w-8 items-center justify-center rounded-full text-[var(--tt-icon)] transition-colors hover:bg-[var(--tt-field)]"
      >
        <MoreIcon className="h-5 w-5" />
      </button>

      {menuOpen && (
        <div
          role="menu"
          className="absolute right-0 bottom-10 z-[101] w-44 overflow-hidden rounded-[8px] bg-[#252525] py-1 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDraftVisibility(visibility);
              setDraftCommentsOff(commentsOff);
              setDialog("privacy");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[15px] text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10"
          >
            <EyeOffIcon className="h-4 w-4 flex-none" />
            Privacy settings
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setMenuOpen(false);
              setDialog("delete");
            }}
            className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[15px] text-[var(--tt-text)] transition-colors duration-200 ease-out hover:bg-white/10"
          >
            <Trash2 className="h-4 w-4 flex-none" strokeWidth={2} />
            Delete
          </button>
        </div>
      )}

      {dialog === "privacy" && (
        <Modal onClose={() => setDialog(null)}>
          <h2 className="text-center text-[20px] font-bold text-[var(--tt-text)]">
            Privacy settings
          </h2>
          <p className="mt-5 text-[15px] font-semibold text-[var(--tt-text)]">
            Who can watch this video
          </p>
          <select
            value={draftVisibility}
            onChange={(event) =>
              setDraftVisibility(event.target.value as VideoVisibility)
            }
            className="mt-2 w-full rounded-[8px] border border-[var(--tt-divider)] bg-[var(--tt-field)] px-3 py-2 text-[15px] text-[var(--tt-text)]"
          >
            <option value="PUBLIC">Everyone</option>
            <option value="FRIENDS">Friends</option>
            <option value="PRIVATE">Only you</option>
          </select>

          <div className="mt-5 flex items-center justify-between">
            <span className="text-[15px] font-semibold text-[var(--tt-text)]">
              Allow comments
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={!draftCommentsOff}
              aria-label="Allow comments"
              onClick={() => setDraftCommentsOff((v) => !v)}
              className={cn(
                "inline-flex h-6 w-11 flex-none items-center rounded-full p-0.5 transition-colors",
                draftCommentsOff
                  ? "bg-[var(--tt-field)]"
                  : "bg-[var(--tt-red)]",
              )}
            >
              <span
                className={cn(
                  "h-5 w-5 rounded-full bg-white transition-transform",
                  draftCommentsOff ? "translate-x-0" : "translate-x-5",
                )}
              />
            </button>
          </div>

          <button
            type="button"
            onClick={saveSettings}
            disabled={savingSettings}
            className="mt-6 w-full text-center text-[16px] font-semibold text-[var(--tt-text)] hover:opacity-80 disabled:opacity-60"
          >
            {savingSettings ? "Saving…" : "Done"}
          </button>
        </Modal>
      )}

      {dialog === "delete" && (
        <Modal
          onClose={() => {
            if (!deleting) setDialog(null);
          }}
        >
          <h2 className="text-center text-[18px] font-bold text-[var(--tt-text)]">
            Are you sure you want to delete this video?
          </h2>
          <div className="mt-6 flex flex-col gap-2">
            <button
              type="button"
              onClick={confirmDelete}
              disabled={deleting}
              className="h-11 rounded-[8px] bg-[var(--tt-red)] text-[15px] font-semibold text-white transition-colors hover:bg-[var(--tt-red-hover)] disabled:opacity-60"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
            <button
              type="button"
              onClick={() => setDialog(null)}
              disabled={deleting}
              className="h-11 rounded-[8px] border border-[var(--tt-divider)] text-[15px] font-semibold text-[var(--tt-text)] transition-colors hover:bg-[var(--tt-field)] disabled:opacity-60"
            >
              Cancel
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
