import type { StoryGroup, StoryResponse } from "@/lib/api/types";

/** Which story the viewer is on: an owner's group, and a story inside it. */
export interface StoryPosition {
  group: number;
  story: number;
}

const IMAGE_MS = 30000;
/** A video whose length moderation could not read still has to advance. */
const UNKNOWN_VIDEO_MS = 15000;

export function next(groups: readonly StoryGroup[], pos: StoryPosition): StoryPosition | null {
  if (pos.story + 1 < groups[pos.group].stories.length) {
    return { group: pos.group, story: pos.story + 1 };
  }
  return pos.group + 1 < groups.length ? { group: pos.group + 1, story: 0 } : null;
}

export function previous(groups: readonly StoryGroup[], pos: StoryPosition): StoryPosition | null {
  if (pos.story > 0) {
    return { group: pos.group, story: pos.story - 1 };
  }
  if (pos.group === 0) {
    return null;
  }
  return { group: pos.group - 1, story: groups[pos.group - 1].stories.length - 1 };
}

export function displayMs(story: StoryResponse): number {
  if (story.mediaType === "IMAGE") {
    return IMAGE_MS;
  }
  return story.durationSeconds ? story.durationSeconds * 1000 : UNKNOWN_VIDEO_MS;
}

export function firstUnseen(group: StoryGroup): number {
  const index = group.stories.findIndex((story) => !story.viewedByMe);
  return index === -1 ? 0 : index;
}

/** The tray after the viewer opened `storyId`: that story marked, its owner's ring recomputed. */
export function markStorySeen(groups: readonly StoryGroup[], storyId: string): StoryGroup[] {
  return groups.map((group) => {
    if (!group.stories.some((story) => story.id === storyId)) {
      return group;
    }
    const stories = group.stories.map((story) =>
      story.id === storyId ? { ...story, viewedByMe: true } : story,
    );
    return { ...group, stories, hasUnseen: group.hasUnseen && stories.some((story) => !story.viewedByMe) };
  });
}

/** Whether `ownerId` has a story still waiting for its moderation verdict. */
export function awaitingReview(groups: readonly StoryGroup[], ownerId: string): boolean {
  return groups.some(
    (group) =>
      group.userId === ownerId && group.stories.some((story) => story.status === "PENDING_MODERATION"),
  );
}
