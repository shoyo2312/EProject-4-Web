"use client";

import { apiFetch } from "@/lib/api/client";
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

export function follow(userId: string): Promise<FollowResponse> {
  return apiFetch<FollowResponse>(`/users/${userId}/follow`, {
    method: "POST",
    auth: "required",
  });
}

export function unfollow(userId: string): Promise<void> {
  return apiFetch<void>(`/users/${userId}/follow`, {
    method: "DELETE",
    auth: "required",
  });
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
 * Whether the viewer follows `userId`, worked out by walking their following
 * list. There is no `GET /users/{id}/relationship` endpoint, and the profile
 * response carries no `isFollowing` flag — this is the only way to answer the
 * question the Follow button asks, so it is deliberately capped rather than
 * paging an unbounded list.
 */
export async function isFollowing(
  viewerId: string,
  userId: string,
  maxPages = 5,
): Promise<boolean> {
  for (let page = 0; page < maxPages; page += 1) {
    const result = await getFollowing(viewerId, page, 50);
    if (result.content.some((profile) => profile.userId === userId)) return true;
    if (page + 1 >= result.page.totalPages) break;
  }
  return false;
}
