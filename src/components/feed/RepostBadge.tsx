"use client";

import Image from "next/image";
import { Repeat2 } from "lucide-react";
import { useEffect, useState } from "react";

import { useSession } from "@/components/session/SessionProvider";
import { Tooltip } from "@/components/ui/Tooltip";
import { toast } from "@/components/ui/toast";
import { resolveAuthor } from "@/lib/api/authors";
import { unrepostVideo } from "@/lib/api/interactions";
import {
  followingIdSet,
  getRepostContext,
  loadRepostContext,
  setRepostedByMe,
  subscribeRepostContext,
} from "@/lib/repost-context";
import { cn } from "@/lib/utils";
import type { Author } from "@/types/tiktok";

/**
 * The reposter's avatar and "You reposted" / "{name} reposted", above the video's owner line.
 *
 * Renders nothing unless the viewer or someone the viewer follows reposted this video — which
 * is what makes it safe to drop onto every surface that renders a video. Only the viewer's own
 * repost can be removed, so the swap button appears only then; someone else's is theirs.
 */
export function RepostBadge({
  videoId,
  className,
}: {
  videoId: string;
  className?: string;
}) {
  const { user } = useSession();
  const viewerId = user?.userId ?? null;

  const [context, setContext] = useState(() => getRepostContext(videoId));
  const [reposter, setReposter] = useState<Author | null>(null);
  const [removing, setRemoving] = useState(false);

  // Mock videos have no backend id, so there is nothing to ask about.
  const isBackendVideo = /^\d+$/.test(videoId);

  useEffect(() => {
    if (!isBackendVideo || !viewerId) return;
    setContext(getRepostContext(videoId));
    loadRepostContext(videoId);
    return subscribeRepostContext(() => setContext(getRepostContext(videoId)));
  }, [videoId, viewerId, isBackendVideo]);

  useEffect(() => {
    if (!context || !viewerId) {
      setReposter(null);
      return;
    }
    if (context.repostedByMe) {
      setReposter(user);
      return;
    }

    let live = true;
    void followingIdSet(viewerId).then(async (following) => {
      const reposterId = context.reposterIds.find(
        (userId) => userId !== viewerId && following.has(userId),
      );
      if (!reposterId) {
        if (live) setReposter(null);
        return;
      }
      const author = await resolveAuthor(reposterId);
      if (live) setReposter(author);
    });

    return () => {
      live = false;
    };
  }, [context, viewerId, user]);

  if (!reposter) return null;

  const label = context?.repostedByMe
    ? "You reposted"
    : `${reposter.nickname} reposted`;

  const remove = async () => {
    if (!viewerId || removing) return;
    setRemoving(true);
    try {
      await unrepostVideo(videoId);
      setRepostedByMe(videoId, viewerId, false);
    } catch {
      toast.warning("Couldn’t remove this repost.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <div
      className={cn(
        "flex w-fit items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[13px]",
        "font-semibold text-white backdrop-blur-sm",
        className,
      )}
    >
      <Image
        src={reposter.avatarUrl}
        alt=""
        width={20}
        height={20}
        className="size-5 shrink-0 rounded-full object-cover"
      />
      <span className="max-w-[12rem] truncate">{label}</span>
      {context?.repostedByMe ? (
        <Tooltip label="Remove repost" placement="top">
          <button
            type="button"
            onClick={remove}
            disabled={removing}
            aria-label="Remove repost"
            className="ml-0.5 grid size-5 place-items-center rounded-full transition hover:bg-white/20 disabled:opacity-50"
          >
            <Repeat2 className="size-3.5" aria-hidden />
          </button>
        </Tooltip>
      ) : null}
    </div>
  );
}
