import type { CreatorOverviewResponse, VideoStatus, VideoVisibility } from "@/lib/api/types";

export interface OverviewMetric {
  key: string;
  label: string;
  value: number;
  previous: number;
  series: number[];
}

/**
 * The overview as Studio's metric strip. Profile views and estimated rewards are
 * TikTok's other two cells; the backend has neither, so net followers takes
 * the last place, drawn from the gained and lost columns.
 */
export function overviewMetrics(overview: CreatorOverviewResponse): OverviewMetric[] {
  const { current, previous, daily } = overview;
  return [
    { key: "views", label: "Video views", value: current.views, previous: previous.views, series: daily.map((d) => d.views) },
    { key: "likes", label: "Likes", value: current.likes, previous: previous.likes, series: daily.map((d) => d.likes) },
    { key: "comments", label: "Comments", value: current.comments, previous: previous.comments, series: daily.map((d) => d.comments) },
    { key: "shares", label: "Shares", value: current.shares, previous: previous.shares, series: daily.map((d) => d.shares) },
    {
      key: "followers",
      label: "Net followers",
      value: current.netFollowers,
      previous: previous.netFollowers,
      series: daily.map((d) => d.followersGained - d.followersLost),
    },
  ];
}

/** TikTok's names for who can watch. */
export const PRIVACY_LABEL: Record<VideoVisibility, string> = {
  PUBLIC: "Everyone",
  FRIENDS: "Friends",
  PRIVATE: "Only me",
};

/** What the Posts table says about a video that is not simply live. Null for a live one. */
export const STATUS_LABEL: Record<VideoStatus, string | null> = {
  PROCESSING: "Processing",
  PENDING_MODERATION: "Under review",
  PENDING_REVIEW: "Under review",
  PUBLISHED: null,
  FAILED: "Upload failed",
  REJECTED: "Removed",
  TAKEN_DOWN: "Taken down",
};
