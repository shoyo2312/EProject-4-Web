"use client";

import { Eye, Trash2 } from "lucide-react";
import { useState } from "react";

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

/** The server's page size for viewers — a shorter page is the last. */
const VIEWERS_PAGE = 20;

const STATUS_LABEL: Partial<Record<StoryStatus, string>> = {
  PENDING_MODERATION: "Pending review",
  HELD: "Not shown — it didn’t pass review",
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
  const [viewers, setViewers] = useState<StoryViewer[] | null>(null);
  const [profiles, setProfiles] = useState<Record<string, UserProfileResponse>>({});
  const [more, setMore] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = story.status ? STATUS_LABEL[story.status] : undefined;

  async function loadViewers(before?: string) {
    try {
      const page = await getStoryViewers(story.id, before);
      setViewers((current) => [...(before ? (current ?? []) : []), ...page]);
      setMore(page.length === VIEWERS_PAGE);
      if (page.length > 0) {
        const found = await getProfiles(page.map((viewer) => viewer.viewerId));
        setProfiles((current) => ({
          ...current,
          ...Object.fromEntries(found.map((profile) => [profile.userId, profile])),
        }));
      }
    } catch (caught) {
      setError(messageFor(caught, "Couldn’t load who viewed this story."));
    }
  }

  function toggleViewers() {
    if (viewers) {
      setViewers(null);
      onBusy(false);
    } else {
      onBusy(true);
      void loadViewers();
    }
  }

  async function changeVisibility(visibility: StoryVisibility) {
    try {
      await updateStoryVisibility(story.id, visibility);
      onChanged();
    } catch (caught) {
      setError(messageFor(caught, "Couldn’t change who can see this story."));
    }
  }

  async function remove() {
    try {
      await deleteStory(story.id);
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

        <select
          value={story.visibility}
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
            <button type="button" onClick={() => { setConfirming(false); onBusy(false); }} className="font-semibold">
              Cancel
            </button>
          </span>
        ) : (
          <button type="button" aria-label="Delete story" onClick={() => { setConfirming(true); onBusy(true); }}
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
