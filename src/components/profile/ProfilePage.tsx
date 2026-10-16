"use client";

import { useState } from "react";

import {
  EditProfileModal,
  type ProfileDraft,
} from "@/components/profile/EditProfileModal";
import {
  FollowListModal,
  type FollowTab,
} from "@/components/profile/FollowListModal";
import { ProfileBody } from "@/components/profile/ProfileBody";
import { ProfileHeader } from "@/components/profile/ProfileHeader";
import { useSession } from "@/components/session/SessionProvider";
import { toast } from "@/components/ui/toast";
import type { FollowStatus, ProfileTab, UserProfile } from "@/types/tiktok";

/**
 * `.StyledShareLayoutV2` — the profile's content column.
 *
 * Its padding ladder is the profile's own (1200 / 1024 / 840), not the feed's,
 * and the 1296px cap is a *content* box: the padding sits outside it, which is
 * why the column is `box-content`.
 *
 * Every change is a request `BackendProfilePage` makes to user-service; this
 * component only reflects what came back.
 */
export function ProfilePage({
  profile,
  onSaveProfile,
  onToggleFollow,
  usernameChangeableAt,
  nicknameChangeableAt,
  onTabSelect,
  onLoadMoreVideos,
  pendingTab,
  pendingCount,
}: {
  profile: UserProfile;
  /**
   * Persists an edit; absent unless the viewer owns the profile. Throwing
   * leaves the modal open with the error shown.
   */
  onSaveProfile?: (draft: ProfileDraft) => Promise<void>;
  /** Persists a follow/unfollow. Throwing reverts the button. */
  onToggleFollow: (next: boolean) => Promise<FollowStatus>;
  /** The owner's rename locks, passed through to the Edit profile modal. */
  usernameChangeableAt?: string | null;
  nicknameChangeableAt?: string | null;
  /** Lets a backend-backed page load a tab's videos when it is opened. */
  onTabSelect?: (tab: ProfileTab) => void;
  /** Fetches the Videos grid's next page; absent once there is none. */
  onLoadMoreVideos?: () => void;
  /** Tab still fetching its videos, and how many are coming — see `ProfileBody`. */
  pendingTab?: ProfileTab | null;
  pendingCount?: number;
}) {
  const { user, requireSignIn } = useSession();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [followTab, setFollowTab] = useState<FollowTab | null>(null);

  const isOwner = user !== null && user.userId === profile.author.userId;

  const save = async (draft: ProfileDraft) => {
    if (!onSaveProfile) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSaveProfile(draft);
      setEditing(false);
      toast.success("Profile updated.");
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : "Could not save your profile.";
      setSaveError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <main className="h-screen flex-1 overflow-y-auto">
      <div className="mx-auto box-content max-w-[1296px] px-8 py-6 tt-1200:px-5 tt-1024:py-5 tt-840:p-3">
        <ProfileHeader
          profile={profile}
          isOwner={isOwner}
          requireSignIn={requireSignIn}
          onEditProfile={() => setEditing(true)}
          onToggleFollow={onToggleFollow}
          // The lists themselves still need a token, so a guest is asked to log in.
          onOpenFollowers={() => {
            if (requireSignIn()) setFollowTab("followers");
          }}
          onOpenFollowing={() => {
            if (requireSignIn()) setFollowTab("following");
          }}
        />

        <ProfileBody
          profile={profile}
          isOwner={isOwner}
          onTabSelect={onTabSelect}
          onLoadMoreVideos={onLoadMoreVideos}
          pendingTab={pendingTab}
          pendingCount={pendingCount}
        />
      </div>

      {followTab && (
        <FollowListModal
          targetUserId={profile.author.userId}
          initialTab={followTab}
          followerCount={profile.stats.followers}
          followingCount={profile.stats.following}
          onClose={() => setFollowTab(null)}
        />
      )}

      {editing && (
        <EditProfileModal
          profile={profile}
          saving={saving}
          error={saveError}
          usernameChangeableAt={usernameChangeableAt}
          nicknameChangeableAt={nicknameChangeableAt}
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
