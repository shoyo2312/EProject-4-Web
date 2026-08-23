"use client";

import { useCallback, useEffect, useState } from "react";

import type { ProfileDraft } from "@/components/profile/EditProfileModal";
import { ProfilePage } from "@/components/profile/ProfilePage";
import { ProfileSkeleton } from "@/components/profile/ProfileSkeleton";
import { useSession } from "@/components/session/SessionProvider";
import {
  authorFromProfile,
  profileToUserProfile,
  videoToProfileVideo,
} from "@/lib/api/adapters";
import { isApiError, messageFor } from "@/lib/api/errors";
import * as usersApi from "@/lib/api/users";
import { getUserVideos } from "@/lib/api/videos";
import type { UserProfile } from "@/types/tiktok";

/**
 * A profile page built from user-service and video-service.
 *
 * Addressed by id, or by `userId: undefined` for "whoever is signed in",
 * because user-service has no handle to look up by — see the note in
 * `lib/api/adapters.ts`. The signed-in viewer still reaches their own page
 * through their real handle, which the route resolves against the session.
 *
 * The prop is a plain string rather than a `{ kind }` object on purpose: an
 * object literal from the parent would be a new value on every render, which
 * would make the loader below a new function, which would re-fire its effect,
 * whose own `setState` would render again — a fetch loop with no exit.
 */
export function BackendProfilePage({ userId }: { userId?: string }) {
  const session = useSession();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [error, setError] = useState<string | null>(null);

  const viewerId = session.user?.userId;
  const sessionSettled = !session.isLoading;
  const targetId = userId ?? viewerId;

  const load = useCallback(async () => {
    // Nothing is fetched until the session has settled. A profile loaded while
    // `/me` is still in flight would compute "not following" from a viewer id
    // that does not exist yet, and the Follow button would lie.
    if (!sessionSettled) return;
    if (!userId && !session.user) return;

    setError(null);

    try {
      const raw = userId
        ? await usersApi.getProfile(userId)
        : await usersApi.getMyProfile();

      const isOwnPage = viewerId !== undefined && viewerId === raw.userId;

      const author =
        isOwnPage && session.user ? { ...session.user } : authorFromProfile(raw);

      /**
       * Called for yourself this returns PROCESSING and PRIVATE videos too, so
       * the owner's grid is genuinely "my videos" rather than only what the
       * public sees.
       */
      const videos = await getUserVideos(raw.userId, 0, 30);

      const isFollowing =
        viewerId !== undefined && !isOwnPage
          ? await usersApi.isFollowing(viewerId, raw.userId).catch(() => false)
          : false;

      setProfile(
        profileToUserProfile(
          raw,
          author,
          videos.content.map(videoToProfileVideo),
          { isFollowing },
        ),
      );
    } catch (cause) {
      // A 404 is deliberately ambiguous — no such account, or a block in either
      // direction. It is never presented as one or the other.
      setError(messageFor(cause));
    }
  }, [userId, sessionSettled, session.user, viewerId]);

  useEffect(() => {
    load();
  }, [load]);

  if (error) {
    return (
      <Centered>
        <p className="text-[16px] text-[var(--tt-text)]">{error}</p>
      </Centered>
    );
  }

  if (!profile) {
    return <ProfileSkeleton />;
  }

  const saveProfile = async (draft: ProfileDraft) => {
    /**
     * Only what actually changed goes in the body. This is not tidiness: on
     * this endpoint an empty string **deletes** the field, so posting the whole
     * form would wipe a bio the viewer never touched.
     */
    const patch: { displayName?: string; bio?: string; avatarUrl?: string } = {};
    if (draft.nickname !== profile.author.nickname) {
      patch.displayName = draft.nickname;
    }
    if (draft.bio !== profile.bio) patch.bio = draft.bio;
    if (draft.avatarUrl !== profile.author.avatarUrl) {
      patch.avatarUrl = draft.avatarUrl;
    }
    if (Object.keys(patch).length === 0) return;

    try {
      await session.updateProfile(patch);
      await load();
    } catch (cause) {
      throw new Error(messageFor(cause));
    }
  };

  /**
   * Ownership is decided by the id that came back, not by how the page was
   * addressed: `/@<your id>` and `/@<your handle>` are the same account, and
   * only the id is comparable — the handle is unknown for everyone but the
   * viewer.
   */
  const isOwner =
    session.user !== null && session.user.userId === profile.author.userId;

  const toggleFollow = async (next: boolean) => {
    if (targetId === undefined || isOwner) return;

    try {
      if (next) await usersApi.follow(targetId);
      else await usersApi.unfollow(targetId);
    } catch (cause) {
      /**
       * `ALREADY_FOLLOWING` / `NOT_FOLLOWING` mean the server already agrees
       * with where the button just moved — a stale view, not a failure, so the
       * optimistic state stands. Everything else propagates and reverts it.
       */
      if (
        isApiError(cause) &&
        (cause.is("ALREADY_FOLLOWING") || cause.is("NOT_FOLLOWING"))
      ) {
        return;
      }
      throw cause;
    } finally {
      /**
       * Only the target's counts can have moved, so this re-reads the profile
       * alone. `load()` here also refetched thirty videos and walked the
       * following list again — three requests against a gateway that allows
       * twenty a second for every viewer sharing the Next proxy's IP.
       */
      usersApi
        .getProfile(targetId)
        .then((raw) =>
          setProfile((current) =>
            current
              ? {
                  ...current,
                  stats: {
                    ...current.stats,
                    followers: raw.followerCount,
                    following: raw.followingCount,
                  },
                }
              : current,
          ),
        )
        .catch(() => undefined);
    }
  };

  return (
    <ProfilePage
      profile={profile}
      onSaveProfile={isOwner ? saveProfile : undefined}
      onToggleFollow={toggleFollow}
      usernameLocked
      avatarAsUrl
    />
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex h-screen flex-1 items-center justify-center">
      {children}
    </main>
  );
}
