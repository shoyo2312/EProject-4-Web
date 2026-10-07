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
 * total likes. Backend contract, not yet emitted: see the note left in
 * `BackendProfilePage.tsx` for what user-service (follow/unfollow) and the
 * likes aggregator need to publish. Until then this subscribes to nothing
 * useful and the frame simply never arrives — no FE change needed once it does.
 *
 * Single id, unlike `useVideoRealtime`: a profile page only ever watches the
 * one account it is showing.
 */
export function useUserRealtime(
  userId: string | null,
  enabled: boolean,
  onFrame: (frame: UserStatsFrame) => void,
) {
  useStompTopic(enabled && userId ? `/topic/users.${userId}` : null, onFrame);
}
