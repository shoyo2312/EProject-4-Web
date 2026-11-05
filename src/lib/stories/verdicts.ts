import type { StoryGroup, StoryResponse } from "@/lib/api/types";

/**
 * Which of `ownerId`'s stories moderation decided between two reads of the tray: those that were
 * `PENDING_MODERATION` in `previous` (matched by id) and are now `ACTIVE` (`live`) or `HELD` /
 * `REJECTED` (`hidden`). Anything else — other owners, stories that were already decided — is left out.
 */
export function decidedSince(
  previous: readonly StoryGroup[],
  current: readonly StoryGroup[],
  ownerId: string,
): { live: StoryResponse[]; hidden: StoryResponse[] } {
  const wasPending = new Set(
    previous
      .filter((group) => group.userId === ownerId)
      .flatMap((group) => group.stories)
      .filter((story) => story.status === "PENDING_MODERATION")
      .map((story) => story.id),
  );
  const decided = current
    .filter((group) => group.userId === ownerId)
    .flatMap((group) => group.stories)
    .filter((story) => wasPending.has(story.id));
  return {
    live: decided.filter((story) => story.status === "ACTIVE"),
    hidden: decided.filter((story) => story.status === "HELD" || story.status === "REJECTED"),
  };
}
