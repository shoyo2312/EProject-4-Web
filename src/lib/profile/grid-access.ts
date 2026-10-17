import type { FriendshipResponse } from "@/lib/api/types";

type Relationship = Pick<FriendshipResponse, "following" | "friends" | "privateAccount">;

/**
 * Whether the viewer's relationship to an account moved in a way that changes
 * which of its videos video-service will hand over — the grid has to be read
 * again, a header update is not enough.
 *
 * Becoming friends (or no longer) moves FRIENDS videos in or out on any
 * account. Following only matters on a private one, where it is the key to the
 * whole grid; on a public account it changes the button and nothing else. A
 * privacy switch either way opens or shuts the grid.
 */
export function gridAccessChanged(before: Relationship, after: Relationship): boolean {
  if (before.privateAccount !== after.privateAccount) return true;
  if (before.friends !== after.friends) return true;
  return after.privateAccount && before.following !== after.following;
}
