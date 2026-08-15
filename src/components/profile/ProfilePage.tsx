"use client";

import { useState } from "react";

import {
  EditProfileModal,
  type ProfileDraft,
} from "@/components/profile/EditProfileModal";
import { ProfileBody } from "@/components/profile/ProfileBody";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { useSession } from "@/components/session/SessionProvider";
import type { UserProfile } from "@/types/tiktok";

/**
 * `.StyledShareLayoutV2` — the profile's content column.
 *
 * Its padding ladder is the profile's own (1200 / 1024 / 840), not the feed's,
 * and the 1296px cap is a *content* box: the padding sits outside it, which is
 * why the column is `box-content`.
 *
 * Two modes, one layout. With no `onSaveProfile`/`onToggleFollow` it edits a
 * local copy, which is what the mock profiles still do. `BackendProfilePage`
 * passes both, and then every change is a request to user-service and this
 * component only reflects what came back.
 */
export function ProfilePage({
  profile,
  onSaveProfile,
  onToggleFollow,
  usernameLocked,
  avatarAsUrl,
}: {
  profile: UserProfile;
  /** Persists an edit. Throwing leaves the modal open with the error shown. */
  onSaveProfile?: (draft: ProfileDraft) => Promise<void>;
  /** Persists a follow/unfollow. Throwing reverts the button. */
  onToggleFollow?: (next: boolean) => Promise<void>;
  /** auth-service has no rename endpoint, so backend handles are read-only. */
  usernameLocked?: boolean;
  /** No upload service yet: the avatar is entered as an allow-listed URL. */
  avatarAsUrl?: boolean;
}) {
  const { user, requireSignIn, updateUser } = useSession();

  /**
   * The local copy. In backend mode it is refreshed from the response, so this
   * is the render state either way.
   */
  const [localProfile, setLocalProfile] = useState(profile);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Backend accounts are matched on id — a handle cannot identify them, since
  // user-service stores none. Mock profiles still match on their handle.
  const isOwner =
    (user?.userId !== undefined && user.userId === profile.author.userId) ||
    (profile.author.userId === undefined &&
      user?.username === profile.author.username);

  const current = profile.author.userId !== undefined ? profile : localProfile;

  const save = async (draft: ProfileDraft) => {
    if (onSaveProfile) {
      setSaving(true);
      setSaveError(null);
      try {
        await onSaveProfile(draft);
        setEditing(false);
      } catch (cause) {
        setSaveError(
          cause instanceof Error ? cause.message : "Could not save your profile.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }

    // Mock mode: there is nothing to send to, so the edit lives on the page.
    setLocalProfile((currentProfile) => ({
      ...currentProfile,
      bio: draft.bio,
      author: {
        ...currentProfile.author,
        username: draft.username,
        nickname: draft.nickname,
        avatarUrl: draft.avatarUrl,
      },
    }));
    updateUser({
      username: draft.username,
      nickname: draft.nickname,
      avatarUrl: draft.avatarUrl,
    });
    setEditing(false);
  };

  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto box-content max-w-[1296px] px-8 py-6 tt-1200:px-5 tt-1024:py-5 tt-840:p-3">
        <ProfileHeader
          profile={current}
          isOwner={isOwner}
          requireSignIn={requireSignIn}
          onEditProfile={() => setEditing(true)}
          onToggleFollow={onToggleFollow}
        />

        <ProfileBody profile={current} isOwner={isOwner} />
      </div>

      {editing && (
        <EditProfileModal
          profile={current}
          saving={saving}
          error={saveError}
          usernameLocked={usernameLocked}
          avatarAsUrl={avatarAsUrl}
          onClose={() => {
            setEditing(false);
            setSaveError(null);
          }}
          onSave={save}
        />
      )}
    </main>
  );
}
