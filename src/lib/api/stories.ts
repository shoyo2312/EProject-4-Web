import { apiFetch } from "./client";
import type {
  StoryGroup,
  StoryResponse,
  StoryRing,
  StoryViewer,
  StoryVisibility,
  UploadUrlResponse,
} from "./types";

/**
 * story-service, behind `/api/v1/stories`. Posting is three steps, like a video: presign, upload
 * the file straight to storage with `uploadToStorage` from `./videos`, then create the story with
 * the `fileUrl` from step one. See `tiktok-backend/docs/story-service-api.md`.
 */

export function createStoryUploadUrl(contentType: string): Promise<UploadUrlResponse> {
  return apiFetch<UploadUrlResponse>("/stories/upload-url", {
    method: "POST",
    body: { contentType },
    auth: "required",
  });
}

export function createStory(input: {
  mediaUrl: string;
  caption: string | null;
  visibility: StoryVisibility;
}): Promise<StoryResponse> {
  return apiFetch<StoryResponse>("/stories", { method: "POST", body: input, auth: "required" });
}

/** The tray. The viewer's own group comes first whatever is passed. */
export function getStoryFeed(followedUserIds: readonly string[]): Promise<StoryGroup[]> {
  return apiFetch<StoryGroup[]>("/stories/feed", {
    query: { followedUserIds: followedUserIds.join(",") },
    auth: "required",
  });
}

/**
 * Which of these accounts get a ring. At most 100 ids per call — more is a 400, so `createRingStore`
 * chunks. Ids shorter than 16 digits come back from the JSON parser as numbers, hence `String()`:
 * a `Map` keyed by string would miss them (see `resolveAuthors`).
 */
export async function getStoryRings(userIds: readonly string[]): Promise<StoryRing[]> {
  const rings = await apiFetch<StoryRing[]>("/stories/rings", {
    query: { userIds: userIds.join(",") },
    auth: "optional",
  });
  return rings.map((ring) => ({ ...ring, userId: String(ring.userId) }));
}

export function getUserStories(userId: string): Promise<StoryResponse[]> {
  return apiFetch<StoryResponse[]>(`/stories/users/${userId}`, { auth: "optional" });
}

export function getStory(storyId: string): Promise<StoryResponse> {
  return apiFetch<StoryResponse>(`/stories/${storyId}`, { auth: "optional" });
}

export function recordStoryView(storyId: string): Promise<void> {
  return apiFetch<void>(`/stories/${storyId}/views`, { method: "POST", auth: "required" });
}

/** Newest first; pass the last `viewedAt` as `before` for the next page. */
export function getStoryViewers(storyId: string, before?: string): Promise<StoryViewer[]> {
  return apiFetch<StoryViewer[]>(`/stories/${storyId}/viewers`, {
    query: { before },
    auth: "required",
  });
}

export function updateStoryVisibility(
  storyId: string,
  visibility: StoryVisibility,
): Promise<StoryResponse> {
  return apiFetch<StoryResponse>(`/stories/${storyId}/visibility`, {
    method: "PATCH",
    body: { visibility },
    auth: "required",
  });
}

export function deleteStory(storyId: string): Promise<void> {
  return apiFetch<void>(`/stories/${storyId}`, { method: "DELETE", auth: "required" });
}
