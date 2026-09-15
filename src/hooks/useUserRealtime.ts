import { useEffect, useRef } from "react";
import type { StompSubscription } from "@stomp/stompjs";
import { getStompClient, onStompConnect } from "@/lib/realtime/stompClient";

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
  token: string | null,
  onFrame: (frame: UserStatsFrame) => void,
) {
  const handler = useRef(onFrame);
  useEffect(() => {
    handler.current = onFrame;
  });

  useEffect(() => {
    if (!token || !userId) return;
    const client = getStompClient(token);
    let subscription: StompSubscription | null = null;

    const sync = () => {
      if (!client.connected || subscription) return;
      subscription = client.subscribe(`/topic/users.${userId}`, (message) => {
        handler.current(JSON.parse(message.body) as UserStatsFrame);
      });
    };

    sync();
    const unsubscribeConnect = onStompConnect(sync);

    return () => {
      unsubscribeConnect();
      subscription?.unsubscribe();
      subscription = null;
    };
  }, [userId, token]);
}
