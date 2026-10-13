"use client";

import { apiFetch } from "@/lib/api/client";
import { isApiError, isRetryable } from "@/lib/api/errors";
import { isLastPage } from "@/lib/api/types";
import type {
  FollowResponse,
  FriendshipResponse,
  PageResponse,
  UserProfileResponse,
  UserSettingsResponse,
} from "@/lib/api/types";

/**
 * user-service. Reading a profile — by id, by handle, or a batch of them — is
 * public, like the videos on it; everything else here needs a token.
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
  return apiFetch<UserProfileResponse>(`/users/${userId}`, { auth: "optional" });
}

/**
 * `GET /api/v1/users/by-username/{username}` — the same profile addressed by handle,
 * for a `/@name` URL. Case-insensitive; 404s exactly as `getProfile` does, which
 * again means "not there, or you two blocked each other" and nothing finer.
 */
export function getProfileByUsername(
  username: string,
): Promise<UserProfileResponse> {
  return apiFetch<UserProfileResponse>(
    `/users/by-username/${encodeURIComponent(username)}`,
    { auth: "optional" },
  );
}

/**
 * Cap on one `getProfiles` call, mirroring user-service's `MAX_BATCH_IDS`.
 * More than this is a `TooManyProfileIdsException`, so callers chunk.
 */
export const MAX_PROFILE_BATCH = 100;

/**
 * `GET /api/v1/users?ids=1,2,3` — hydrates a list of ids in one request.
 *
 * Ids the viewer cannot see (no profile, or a block either way) are **absent
 * from the answer** rather than failing it, so the list can come back shorter
 * than `userIds` and in any order. Key it by `userId`; never index by position.
 */
export function getProfiles(
  userIds: string[],
): Promise<UserProfileResponse[]> {
  return apiFetch<UserProfileResponse[]>("/users", {
    query: { ids: userIds.join(",") },
    auth: "optional",
  });
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

/**
 * Every mounted Follow control. The cache is the single answer for the whole
 * tab, so a toggle on one video's button has to reach the button on the next
 * video by the same author — which is already rendered and would otherwise keep
 * its own stale copy until a reload.
 */
const followListeners = new Set<() => void>();

function notifyFollowState(): void {
  for (const listener of followListeners) listener();
}

/** Subscribe to follow-cache writes. Returns the unsubscribe. */
export function subscribeFollowState(listener: () => void): () => void {
  followListeners.add(listener);
  return () => {
    followListeners.delete(listener);
  };
}

/** The one way to write the cache: every write has to wake the buttons. */
export function setFollowState(userId: string, value: boolean): void {
  if (followState.get(userId) === value) return;
  followState.set(userId, value);
  notifyFollowState();
}

/**
 * Private accounts the viewer has a follow request waiting on. Beside
 * `followState` rather than in it: the following-list walk can only answer
 * yes or no, and a request is neither. Known from a follow's answer or a
 * friendship read, never walked — so "not in here" means "not known".
 */
const requestedState = new Set<string>();

/** Writes the request half of the cache, waking the buttons like `setFollowState`. */
export function setFollowRequested(userId: string, value: boolean): void {
  if (requestedState.has(userId) === value) return;
  if (value) requestedState.add(userId);
  else requestedState.delete(userId);
  notifyFollowState();
}

export function peekRequested(userId: string): boolean {
  return requestedState.has(userId);
}

/** Called on sign-in/sign-out: one viewer's answers must not serve another. */
export function clearFollowCache(): void {
  followEpoch += 1;
  followState.clear();
  requestedState.clear();
  followingWalk = null;
  notifyFollowState();
}

/**
 * Synchronous peek at what `isFollowing` would answer from cache — `undefined`
 * when it would have to walk the following list. Lets a button seed its initial
 * state without a render on the wrong value first (the Follow/Following flash).
 */
export function peekFollowState(userId: string): boolean | undefined {
  return followState.get(userId);
}

export async function follow(userId: string): Promise<FollowResponse> {
  try {
    const result = await apiFetch<FollowResponse>(`/users/${userId}/follow`, {
      method: "POST",
      auth: "required",
    });
    // A private account only records a request: "Following" would be a lie.
    setFollowState(userId, result.status === "FOLLOWING");
    setFollowRequested(userId, result.status === "REQUESTED");
    return result;
  } catch (cause) {
    // `ALREADY_FOLLOWING` is the server saying it already agrees with where
    // the button moved. The cache has to hear that too, or it keeps answering
    // with the stale value that made the call redundant in the first place.
    if (isApiError(cause) && cause.is("ALREADY_FOLLOWING")) {
      setFollowState(userId, true);
    }
    if (isApiError(cause) && cause.is("ALREADY_REQUESTED")) {
      setFollowRequested(userId, true);
    }
    throw cause;
  }
}

/** The viewer's relationship to one account — exact, unlike `isFollowing`'s capped walk. */
export async function getFriendship(userId: string): Promise<FriendshipResponse> {
  const result = await apiFetch<FriendshipResponse>(`/users/${userId}/friendship`, {
    auth: "required",
  });
  setFollowState(userId, result.following);
  setFollowRequested(userId, result.requested);
  return result;
}

/** Unfollows — or, to a private account still deciding, withdraws the request. */
export async function unfollow(userId: string): Promise<void> {
  try {
    await apiFetch<void>(`/users/${userId}/follow`, {
      method: "DELETE",
      auth: "required",
    });
    setFollowState(userId, false);
    setFollowRequested(userId, false);
  } catch (cause) {
    if (isApiError(cause) && cause.is("NOT_FOLLOWING")) {
      setFollowState(userId, false);
      setFollowRequested(userId, false);
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

export async function block(userId: string): Promise<void> {
  await apiFetch<void>(`/users/${userId}/block`, {
    method: "POST",
    auth: "required",
  });
  // The server ends the follows both ways, a pending request included.
  setFollowState(userId, false);
  setFollowRequested(userId, false);
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

/**
 * `GET /api/v1/users/me/follow-requests` — who is waiting on the viewer's
 * approval, newest first. Only a private account collects any.
 */
export function getFollowRequests(
  page = 0,
  size = 20,
): Promise<PageResponse<UserProfileResponse>> {
  return apiFetch<PageResponse<UserProfileResponse>>("/users/me/follow-requests", {
    auth: "required",
    query: { page, size },
  });
}

/** `POST …/follow-requests/{requesterId}/approve` — the requester now follows the viewer. */
export function approveFollowRequest(requesterId: string): Promise<FollowResponse> {
  return apiFetch<FollowResponse>(`/users/me/follow-requests/${requesterId}/approve`, {
    method: "POST",
    auth: "required",
  });
}

/** `DELETE …/follow-requests/{requesterId}` — declined, and the requester is not told. */
export function declineFollowRequest(requesterId: string): Promise<void> {
  return apiFetch<void>(`/users/me/follow-requests/${requesterId}`, {
    method: "DELETE",
    auth: "required",
  });
}

export function getMySettings(): Promise<UserSettingsResponse> {
  return apiFetch<UserSettingsResponse>("/users/me/settings", {
    auth: "required",
  });
}

/**
 * `PATCH /api/v1/users/me/settings` — only the keys the body carries change,
 * and the answer is the whole settings object as it now stands.
 *
 * Not `PATCH /users/me`'s rules: `""` clears nothing here, and `null` is how
 * the three screen-time fields are switched off. The type keeps `null` away
 * from the three fields the server refuses it on.
 *
 * Replayed once on `CONCURRENT_MODIFICATION`, as the contract asks: two
 * devices, or two first writes racing the row's insert. The body is the
 * viewer's own intent, so it is sent again as is rather than re-derived.
 */
export async function updateMySettings(
  patch: Partial<UserSettingsResponse>,
): Promise<UserSettingsResponse> {
  const send = () =>
    apiFetch<UserSettingsResponse>("/users/me/settings", {
      method: "PATCH",
      body: patch,
      auth: "required",
    });

  try {
    return await send();
  } catch (cause) {
    if (isRetryable(cause)) return send();
    throw cause;
  }
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
  const ids = await collectIds((page) => getFollowing(viewerId, page, 50), max);
  for (const userId of ids) followState.set(userId, true);
  notifyFollowState();
  return ids;
}

/**
 * Mutuals — the Friends feed's authors. Two accounts are friends when each
 * follows the other, which is the intersection of the viewer's two listings.
 *
 * Computed here rather than asked for: user-service has no friends endpoint,
 * and the feed it feeds takes any list of author ids, so the only thing a
 * server-side one would save is the second listing walk.
 *
 * Both sides are capped the same way {@link getFollowingIds} is, so a viewer
 * past `max` on either gets the mutuals among the accounts that fit — the same
 * trade the Following feed already makes.
 */
export async function getFriendIds(
  viewerId: string,
  max = 500,
): Promise<string[]> {
  const [following, followers] = await Promise.all([
    getFollowingIds(viewerId, max),
    collectIds((page) => getFollowers(viewerId, page, 50), max),
  ]);

  const followsBack = new Set(followers);
  return following.filter((userId) => followsBack.has(userId));
}

/** Walks a paged profile listing to its end, or to `max` ids, whichever first. */
async function collectIds(
  fetchPage: (page: number) => Promise<PageResponse<UserProfileResponse>>,
  max: number,
): Promise<string[]> {
  const ids: string[] = [];

  for (let page = 0; ids.length < max; page += 1) {
    const result = await fetchPage(page);
    for (const profile of result.content) {
      if (ids.length < max) ids.push(profile.userId);
    }

    if (isLastPage(result.page)) break;
  }

  return ids;
}

/**
 * The walk of the viewer's following list that `isFollowing` answers from,
 * resolving to whether it read the list to its end. One per viewer per tab,
 * shared by every caller: a feed of twenty cards by ten authors asks the
 * question ten times at once, and ten parallel walks of the same list is the
 * gateway's per-IP limit spent on identical requests.
 */
let followingWalk: { viewerId: string; complete: Promise<boolean> } | null = null;
/** Bumped by `clearFollowCache`, so a walk still in flight knows its viewer is gone. */
let followEpoch = 0;

function walkFollowing(viewerId: string, maxPages: number): Promise<boolean> {
  if (followingWalk?.viewerId === viewerId) return followingWalk.complete;

  const epoch = followEpoch;
  const complete = (async () => {
    for (let page = 0; page < maxPages; page += 1) {
      const result = await getFollowing(viewerId, page, 50);
      // `clearFollowCache` (a sign-out, another account) dropped this walk while
      // the page was in flight: its answers belong to the previous viewer.
      if (epoch !== followEpoch) return false;
      for (const profile of result.content) followState.set(profile.userId, true);
      notifyFollowState();
      if (isLastPage(result.page)) return true;
    }
    return false;
  })();

  const walk = { viewerId, complete };
  followingWalk = walk;
  // A failed walk is forgotten, so the next question tries again.
  complete.catch(() => {
    if (followingWalk === walk) followingWalk = null;
  });
  return complete;
}

/**
 * Whether the viewer follows `userId`.
 *
 * `getFriendship` answers this for one account, but there is no batch form of
 * it, and a feed asks about every author on screen at once — one request each.
 * So the cards answer from a walk of the viewer's own following list. That costs up
 * to `maxPages` requests against a gateway that allows 20 per second per IP —
 * and behind the Next proxy every viewer shares one IP — so the walk happens
 * at most once per tab:
 *
 *  - `follow`/`unfollow` write the answer directly, so toggling never walks;
 *  - the walk seeds *every* profile it passes, and is shared by every caller
 *    asking while it runs or after it, so later questions cost nothing;
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

  const complete = await walkFollowing(viewerId, maxPages);
  const found = followState.get(userId);
  if (found !== undefined) return found;

  if (complete) setFollowState(userId, false);
  return false;
}
