import { videoToProfileVideo } from "@/lib/api/adapters";
import type { VideoResponse } from "@/lib/api/types";
import type { ProfileVideo } from "@/types/tiktok";

/**
 * What a fresh copy of one video does to a profile's Videos grid: the tile patched in place, or
 * "reload" when its place may have moved — a pin flipped, and video-service orders pinned videos
 * first — or it is the owner's but not loaded yet. Null when the video is not this profile's.
 */
export function patchGrid(grid: ProfileVideo[], ownerId: string, video: VideoResponse): ProfileVideo[] | "reload" | null {
  if (video.userId !== ownerId) return null;
  const at = grid.findIndex((tile) => tile.id === video.id);
  const next = videoToProfileVideo(video);
  if (at === -1 || Boolean(grid[at].isPinned) !== Boolean(next.isPinned)) return "reload";
  return grid.map((tile, index) => (index === at ? next : tile));
}
