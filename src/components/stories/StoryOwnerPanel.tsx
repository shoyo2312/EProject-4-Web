"use client";

import { Eye, Trash2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { authorFromProfile, unknownAuthor } from "@/lib/api/adapters";
import { messageFor } from "@/lib/api/errors";
import { deleteStory, getStoryViewers, updateStoryVisibility } from "@/lib/api/stories";
import type {
  StoryResponse,
  StoryStatus,
  StoryViewer,
  StoryVisibility,
  UserProfileResponse,
} from "@/lib/api/types";
import { getProfiles } from "@/lib/api/users";
import { formatRelativeTime } from "@/lib/format";
import { emojiOf, REACTIONS } from "@/lib/stories/reactions";

import { useStories } from "./StoriesProvider";

/** The server's page size for viewers — a shorter page is the last. */
const VIEWERS_PAGE = 20;

const STATUS_LABEL: Partial<Record<StoryStatus, string>> = {
  PENDING_MODERATION: "Pending review",
  // The model was unsure, or could not score it at all: hidden either way, and nobody reviews it.
  HELD: "Only you can see this — it couldn’t be cleared in review",
  REJECTED: "Removed — it goes against our Community Guidelines",
};

/**
 * Under the owner's own story: where it stands in moderation, who watched it, who may see it, and
 * a way to take it down. `onBusy` pauses the player while a list or a confirmation is open.
 */
export function StoryOwnerPanel({
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
  const [viewers, setViewers] = useState<StoryViewer[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfileResponse>>({});
  const [more, setMore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Shown at once; the tray's copy of the story catches up when `onChanged` reloads it.
  const [visibility, setVisibility] = useState(story.visibility);

  const label = story.status ? STATUS_LABEL[story.status] : undefined;

  const open = viewers !== null || confirming;
  const onBusyRef = useRef(onBusy);
  useEffect(() => {
    onBusyRef.current = onBusy;
  });
  useEffect(() => {
    onBusyRef.current(open);
  }, [open]);

  async function loadViewers(before?: string) {
    let page: StoryViewer[];
    try {
      page = await getStoryViewers(story.id, before);
    } catch (caught) {
      setError(messageFor(caught, "Couldn’t load who viewed this story."));
      return;
    }
    setViewers((current) => [...(before ? (current ?? []) : []), ...page]);
    setMore(page.length === VIEWERS_PAGE);
    if (page.length === 0) return;
    // Without profiles the rows still list who watched and when, under placeholder names.
    const found = await getProfiles(page.map((viewer) => viewer.viewerId)).catch(() => []);
    setProfiles((current) => ({
      ...current,
      ...Object.fromEntries(found.map((profile) => [profile.userId, profile])),
    }));
  }

  function toggleViewers() {
    if (viewers) setViewers(null);
    else void loadViewers();
  }

  async function changeVisibility(next: StoryVisibility) {
    const before = visibility;
    setVisibility(next);
    setError(null);
    try {
      await updateStoryVisibility(story.id, next);
      onChanged();
    } catch (caught) {
      setVisibility(before);
      setError(messageFor(caught, "Couldn’t change who can see this story."));
    }
  }

  async function remove() {
    try {
      await deleteStory(story.id);
      invalidateOwnRing();
      onDeleted();
    } catch (caught) {
      setError(messageFor(caught, "Couldn’t delete this story."));
    }
  }

  return (
    <div className="bg-black/80 px-4 py-3 text-white">
      {label && (
        <p className="mb-2 rounded-[4px] bg-white/10 px-3 py-1.5 text-[13px] font-semibold">{label}</p>
      )}

      <div className="flex items-center gap-3">
        <button type="button" onClick={toggleViewers}
          className="flex items-center gap-1.5 text-[14px] font-semibold hover:underline">
          <Eye className="h-4 w-4" />
          {story.viewCount ?? 0} {story.viewCount === 1 ? "view" : "views"}
        </button>
        {REACTIONS.filter(({ type }) => (story.reactionCounts?.[type] ?? 0) > 0).map(({ type, emoji, label }) => (
          <span key={type} aria-label={`${story.reactionCounts?.[type]} ${label}`}
            className="rounded-full bg-white/10 px-2 py-0.5 text-[13px]">
            {emoji} {story.reactionCounts?.[type]}
          </span>
        ))}

        <select
          value={visibility}
          onChange={(event) => void changeVisibility(event.target.value as StoryVisibility)}
          aria-label="Who can see this story"
          className="ml-auto h-8 rounded-[4px] bg-white/[0.12] px-2 text-[13px] text-white outline-none"
        >
          <option value="PUBLIC">Everyone</option>
          <option value="FRIENDS">Friends</option>
          <option value="PRIVATE">Only you</option>
        </select>

        {confirming ? (
          <span className="flex items-center gap-2 text-[13px]">
            Delete?
            <button type="button" onClick={() => void remove()} className="font-semibold text-[var(--tt-red)]">
              Delete
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="font-semibold">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" aria-label="Delete story" onClick={() => setConfirming(true)}
            className="rounded-full p-1.5 hover:bg-white/10">
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      {error && <p className="mt-2 text-[13px] text-[var(--tt-red)]">{error}</p>}

      {viewers && (
        <ul className="mt-3 max-h-[30vh] space-y-2 overflow-y-auto">
          {viewers.length === 0 && <li className="text-[13px] text-white/70">No views yet.</li>}
          {viewers.map((viewer) => {
            const profile = profiles[viewer.viewerId];
            const author = profile ? authorFromProfile(profile) : unknownAuthor(viewer.viewerId);
            return (
              <li key={viewer.viewerId} className="flex items-center gap-2 text-[14px]">
                {/* eslint-disable-next-line @next/next/no-img-element -- avatar URL comes from user-service, not the image pipeline */}
                <img src={author.avatarUrl} alt="" referrerPolicy="no-referrer"
                  className="h-7 w-7 rounded-full bg-[rgb(136_136_136/0.5)] object-cover" />
                <span className="truncate">{author.nickname}</span>
                {viewer.reaction && <span aria-label={viewer.reaction.toLowerCase()}>{emojiOf(viewer.reaction)}</span>}
                <span className="ml-auto text-[12px] text-white/60">{formatRelativeTime(viewer.viewedAt)}</span>
              </li>
            );
          })}
          {more && (
            <li>
              <button type="button" onClick={() => void loadViewers(viewers[viewers.length - 1]?.viewedAt)}
                className="text-[13px] font-semibold hover:underline">
                Load more
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
