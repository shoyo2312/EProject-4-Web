"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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
import { listLikedVideos, listSavedVideos } from "@/lib/api/interactions";
import * as usersApi from "@/lib/api/users";
import { getUserVideos, getUserVideoStats, getVideosByIds } from "@/lib/api/videos";
import type { ProfileTab, ProfileVideo, UserProfile } from "@/types/tiktok";

/** How many videos the grid asks for in one page. */
const VIDEO_PAGE = 30;

/** Tiles drawn while the video total is unknown — a failed stats call only. */
const DEFAULT_GRID_SKELETON = 12;

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
  /** Tab whose videos are in flight, and how many of them to expect. */
  const [pending, setPending] = useState<{
    tab: ProfileTab;
    count: number;
  } | null>(null);

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
       * Started here, awaited below. The grid is the slow request, so making
       * it queue behind the two small ones would trade a page-wide skeleton
       * for a page-wide delay. Called for yourself it returns PROCESSING and
       * PRIVATE videos too, so the owner's grid is genuinely "my videos"
       * rather than only what the public sees.
       */
      const videosLoading = getUserVideos(raw.userId, 0, VIDEO_PAGE);

      const [isFollowing, stats] = await Promise.all([
        viewerId !== undefined && !isOwnPage
          ? usersApi.isFollowing(viewerId, raw.userId).catch(() => false)
          : Promise.resolve(false),
        // The header's "Likes" and video totals. Not fatal if it fails — the
        // profile still renders, with a zero, rather than the whole page
        // becoming an error over one number.
        getUserVideoStats(raw.userId).catch(() => null),
      ]);

      const withVideos = (videos: ProfileVideo[]) =>
        profileToUserProfile(raw, author, videos, {
          isFollowing,
          totalLikes: stats?.totalLikes,
        });

      /**
       * The header goes up before the grid does. Everything on it is known and
       * honest by now — the follow state included — while the grid is thirty
       * videos and their thumbnails, which is what actually keeps a profile
       * waiting. One page-wide skeleton made the fast half wait for the slow.
       */
      setProfile(withVideos([]));
      // Stats that failed to load leave the count unknown, so the grid falls
      // back to a guess; a real zero means there is nothing to wait for and
      // `ProfileBody` shows the empty state instead of placeholder tiles.
      setPending({
        tab: "videos",
        count: Math.min(stats?.videoCount ?? DEFAULT_GRID_SKELETON, VIDEO_PAGE),
      });

      const videos = await videosLoading;

      setProfile(withVideos(videos.content.map(videoToProfileVideo)));
      setPending(null);
    } catch (cause) {
      // A 404 is deliberately ambiguous — no such account, or a block in either
      // direction. It is never presented as one or the other.
      setError(messageFor(cause));
    }
  }, [userId, sessionSettled, session.user, viewerId]);

  /**
   * Which of the two interaction tabs have already been fetched. A ref, not
   * state: it only ever guards the fetch, and re-rendering on it would be a
   * render per tab opened for nothing.
   */
  const loadedTabs = useRef<Set<ProfileTab>>(new Set());

  /**
   * Favorites and Liked, filled when the tab is opened.
   *
   * Owner only, and not a privacy choice made here: interaction-service serves
   * `/users/me` and nothing else, so another account's list is not fetchable at
   * all — which is what the tab's empty copy already says.
   *
   * ponytail: the first page only, 50 videos. Add cursor paging when a profile
   * grid needs to scroll past that.
   */
  const loadTab = useCallback(
    async (tab: ProfileTab) => {
      const isOwnPage = userId === undefined || userId === viewerId;
      if (!isOwnPage || !viewerId) return;
      if (tab !== "favorites" && tab !== "liked") return;
      if (loadedTabs.current.has(tab)) return;
      loadedTabs.current.add(tab);

      try {
        const page = tab === "liked" ? await listLikedVideos() : await listSavedVideos();
        // The ids arrive one request ahead of the videos, so the tab knows its
        // exact size while the heavy half is still loading — no guess needed.
        setPending({ tab, count: page.videoIds.length });
        // Ids the viewer may no longer see — a deleted video — are simply
        // absent from the reply, so the grid can be shorter than the list.
        const videos = await getVideosByIds(page.videoIds);
        setProfile((current) =>
          current
            ? {
                ...current,
                posts: {
                  ...current.posts,
                  [tab]: videos.map(videoToProfileVideo),
                },
              }
            : current,
        );
        setPending(null);
      } catch {
        // Leave the tab empty and let it be retried: the guard above is what
        // stops a retry, so it has to be given back.
        setPending(null);
        loadedTabs.current.delete(tab);
      }
    },
    [userId, viewerId],
  );

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

    try {
      /**
       * The photo is uploaded here and nowhere earlier: picking one only
       * previewed a `blob:` URL, which is meaningless to the server and must
       * never reach `avatarUrl`. The upload comes first so that a failing one
       * aborts the whole save — the modal stays open with the error rather than
       * reporting success for a name change that went through beside a photo
       * that did not.
       */
      if (draft.avatarFile) {
        const uploaded = await usersApi.uploadMyAvatar(draft.avatarFile);
        session.updateUser({ avatarUrl: uploaded.avatarUrl ?? undefined });
      } else if (Object.keys(patch).length === 0) {
        return;
      }

      if (Object.keys(patch).length > 0) await session.updateProfile(patch);
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
      onTabSelect={loadTab}
      pendingTab={pending?.tab ?? null}
      pendingCount={pending?.count ?? 0}
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
