"use client";

import { apiFetch } from "@/lib/api/client";
import { isApiError } from "@/lib/api/errors";
import { isLastPage } from "@/lib/api/types";
import type {
  FollowResponse,
  PageResponse,
  UserProfileResponse,
} from "@/lib/api/types";

/**
 * user-service. Every endpoint here needs a token — there is no public read,
 * not even for somebody else's profile.
 */

export function getMyProfile(): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>("/users/me", { auth: "required" });
}

/**
 * `GET /api/v1/users/{userId}`. A 404 means "you cannot see this account" and
 * nothing more precise: the server folds "does not exist" together with "one
 * of you blocked the other" on purpose, so the UI must not guess between them.
 */
export function getProfile(userId: string): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(`/users/${userId}`, { auth: "required" });
}

/**
 * `PATCH /api/v1/users/me` — a true partial update, with a trap: an **empty
 * string deletes the field**, while an absent key leaves it alone. So the
 * caller passes only what actually changed, and `""` only when the viewer
 * really cleared the field.
 */
export function updateMyProfile(patch: {
  displayName?: string;
  bio?: string;
  avatarUrl?: string;
}): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>("/users/me", {
    method: "PATCH",
    body: patch,
    auth: "required",
  });
}

/**
 * `GET /api/v1/users/search?q=` — profiles whose handle or display name contains `q`,
 * most-followed first.
 *
 * A token is required, as everywhere in user-service, so a signed-out viewer gets nothing
 * rather than a public result set.
 */
export function searchUsers(
  q: string,
  size = 8,
  signal?: AbortSignal,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>("/users/search", {
    auth: "required",
    query: { q, size },
    signal,
  });
}

/** Image types the avatar endpoint accepts, and what to put in `accept`. */
export const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

/**
 * `POST /api/v1/users/me/avatar` — multipart, one `file` part.
 *
 * The file cannot take the video route: `PATCH /users/me` validates `avatarUrl`
 * against the CDN allow-list (`@ValidMediaUrl`, https only), so a URL the client
 * invents is rejected. The server stores the bytes itself and answers with the
 * profile carrying the URL it chose.
 *
 * Called only from a save, never from the file picker: picking a photo must
 * leave the account untouched until Save is pressed.
 */
export function uploadMyAvatar(file: File): Promise<UserProfileResponse> {
  const form = new FormData();
  form.append("file", file);

  return apiFetch<UserProfileResponse>("/users/me/avatar", {
    method: "POST",
    body: form,
    auth: "required",
  });
}

/**
 * Who the viewer follows, for the life of the tab — see `isFollowing` below
 * for why this exists at all. Keyed by target id only: there is one viewer per
 * tab, and `clearFollowCache` runs on every sign-in and sign-out, exactly as
 * the author cache does.
 */
const followState = new Map<string, boolean>();

/** Called on sign-in/sign-out: one viewer's answers must not serve another. */
export function clearFollowCache(): void {
  followState.clear();
}

export async function follow(userId: string): Promise<FollowResponse> {
  try {
    const result = await apiFetch<FollowResponse>(`/users/${userId}/follow`, {
      method: "POST",
      auth: "required",
    });
    followState.set(userId, true);
    return result;
  } catch (cause) {
    // `ALREADY_FOLLOWING` is the server saying it already agrees with where
    // the button moved. The cache has to hear that too, or it keeps answering
    // with the stale value that made the call redundant in the first place.
    if (isApiError(cause) && cause.is("ALREADY_FOLLOWING")) {
      followState.set(userId, true);
    }
    throw cause;
  }
}

export async function unfollow(userId: string): Promise<void> {
  try {
    await apiFetch<void>(`/users/${userId}/follow`, {
      method: "DELETE",
      auth: "required",
    });
    followState.set(userId, false);
  } catch (cause) {
    if (isApiError(cause) && cause.is("NOT_FOLLOWING")) {
      followState.set(userId, false);
    }
    throw cause;
  }
}

export function getFollowers(
  userId: string,
  page = 0,
  size = 20,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>(
    `/users/${userId}/followers`,
    { auth: "required", query: { page, size } },
  );
}

export function getFollowing(
  userId: string,
  page = 0,
  size = 20,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>(
    `/users/${userId}/following`,
    { auth: "required", query: { page, size } },
  );
}

export function block(userId: string): Promise<void> {
  return apiFetch<void>(`/users/${userId}/block`, {
    method: "POST",
    auth: "required",
  });
}

export function unblock(userId: string): Promise<void> {
  return apiFetch<void>(`/users/${userId}/block`, {
    method: "DELETE",
    auth: "required",
  });
}

/**
 * Mute is independent of block and of follow — muting someone who blocked you
 * succeeds, by design. The UI therefore keeps two separate toggles.
 */
export function mute(userId: string): Promise<void> {
  return apiFetch<void>(`/users/${userId}/mute`, {
    method: "POST",
    auth: "required",
  });
}

export function unmute(userId: string): Promise<void> {
  return apiFetch<void>(`/users/${userId}/mute`, {
    method: "DELETE",
    auth: "required",
  });
}

export function getBlocked(
  page = 0,
  size = 20,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>("/users/me/blocked", {
    auth: "required",
    query: { page, size },
  });
}

export function getMuted(
  page = 0,
  size = 20,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>("/users/me/muted", {
    auth: "required",
    query: { page, size },
  });
}

/**
 * Every account the viewer follows, as ids — what the Following feed is drawn
 * from, since video-service has no read into the follow graph.
 *
 * Walks the paged listing to its end, capped at `max` because that is the
 * server's own ceiling on one Following-feed request. A viewer past it gets a
 * feed built from the first `max` accounts rather than an error; ordering there
 * is the listing's, which is stable, so the same creators are the ones dropped
 * on every page rather than a different set each time.
 *
 * Seeds `followState` on the way through, so the Follow buttons on the videos
 * this feed renders answer without a walk of their own.
 */
export async function getFollowingIds(
  viewerId: string,
  max = 500,
): Promise<string[]> {
  const ids: string[] = [];

  for (let page = 0; ids.length < max; page += 1) {
    const result = await getFollowing(viewerId, page, 50);
    for (const profile of result.content) {
      followState.set(profile.userId, true);
      if (ids.length < max) ids.push(profile.userId);
    }

    if (isLastPage(result.page)) break;
  }

  return ids;
}

/**
 * Whether the viewer follows `userId`.
 *
 * There is no `GET /users/{id}/relationship` endpoint and the profile response
 * carries no `isFollowing` flag, so the only way to answer the question the
 * Follow button asks is to walk the viewer's own following list. That costs up
 * to `maxPages` requests against a gateway that allows 20 per second per IP —
 * and behind the Next proxy every viewer shares one IP — so the walk happens
 * at most once per account per tab:
 *
 *  - `follow`/`unfollow` write the answer directly, so toggling never walks;
 *  - a walk seeds *every* profile it passes, not just the one asked about, so
 *    the second profile page usually costs nothing;
 *  - `false` is only remembered when the list was read to its end. Giving up
 *    at `maxPages` means the answer is a guess, and a guess must not be cached.
 */
export async function isFollowing(
  viewerId: string,
  userId: string,
  maxPages = 5,
): Promise<boolean> {
  const known = followState.get(userId);
  if (known !== undefined) return known;

  for (let page = 0; page < maxPages; page += 1) {
    const result = await getFollowing(viewerId, page, 50);
    for (const profile of result.content) followState.set(profile.userId, true);

    if (result.content.some((profile) => profile.userId === userId)) return true;

    if (page + 1 >= result.page.totalPages) {
      followState.set(userId, false);
      return false;
    }
  }

  return false;
}
