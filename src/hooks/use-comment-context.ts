"use client";

import { useEffect, useState } from "react";

import { resolveAuthors } from "@/lib/api/authors";
import type { CommentResponse, VideoResponse } from "@/lib/api/types";
import { getVideosByIds } from "@/lib/api/videos";
import type { Author } from "@/types/tiktok";

/**
 * Who wrote each comment and which post it sits on — a comment carries ids only.
 * One batch per kind for the ids not resolved yet, so loading more of the inbox
 * only asks about what is new. A post the batch does not return (one still
 * under review, say) keeps a blank cover rather than failing the row.
 */
export function useCommentContext(comments: CommentResponse[]): {
  authors: Map<string, Author>;
  videos: Map<string, VideoResponse>;
} {
  const [authors, setAuthors] = useState<Map<string, Author>>(() => new Map());
  const [videos, setVideos] = useState<Map<string, VideoResponse>>(() => new Map());

  const authorIds = [...new Set(comments.map((c) => c.userId))].filter((id) => !authors.has(id));
  const videoIds = [...new Set(comments.map((c) => c.videoId))].filter((id) => !videos.has(id));
  const authorKey = authorIds.join(",");
  const videoKey = videoIds.join(",");

  useEffect(() => {
    if (!authorKey) return;
    let live = true;
    resolveAuthors(authorKey.split(",")).then((found) => {
      if (live) setAuthors((current) => new Map([...current, ...found]));
    });
    return () => {
      live = false;
    };
  }, [authorKey]);

  useEffect(() => {
    if (!videoKey) return;
    const controller = new AbortController();
    getVideosByIds(videoKey.split(","), controller.signal)
      .then((found) => setVideos((current) => new Map([...current, ...found.map((v) => [v.id, v] as const)])))
      .catch(() => undefined);
    return () => controller.abort();
  }, [videoKey]);

  return { authors, videos };
}
