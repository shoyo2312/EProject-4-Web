import { useStompTopic } from "@/hooks/use-stomp-topic";

export type UserStatsFrame = {
  type: "stats";
  userId: string;
  followerCount?: number;
  followingCount?: number;
  totalLikes?: number;
};

/**
 * Subscribes to one profile's `/topic/users.{userId}` — followers, following,
 * total likes. chat-service's `UserStatsFanout` sends one after a follow edge
 * touching the account (either side) or a like on its videos.
 *
 * Single id, unlike `useVideoRealtime`: a profile page only ever watches the
 * one account it is showing.
 */
export function useUserRealtime(userId: string | null, onFrame: (frame: UserStatsFrame) => void) {
  useStompTopic(userId ? `/topic/users.${userId}` : null, onFrame);
}
