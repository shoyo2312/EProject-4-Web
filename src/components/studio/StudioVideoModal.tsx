"use client";

import { ChevronDown, ChevronUp, Music } from "lucide-react";
import Link from "next/link";
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";

import { CommentPanel } from "@/components/feed/CommentPanel";
import {
  BookmarkIcon,
  CloseIcon,
  CommentIcon,
  HeartIcon,
} from "@/components/icons";
import { usePlayerSettings } from "@/components/player/PlayerSettingsProvider";
import { useSession } from "@/components/session/SessionProvider";
import { formatPostDate } from "@/components/studio/PostCell";
import { Modal } from "@/components/ui/modal";
import { CreatorVideosPanel } from "@/components/video/CreatorVideosPanel";
import { SeekBar } from "@/components/video/detail/SeekBar";
import { VerticalVolumeControl } from "@/components/video/detail/VerticalVolumeControl";
import { isHlsManifest, useHlsSource } from "@/hooks/use-hls-source";
import { useLikeStatuses } from "@/hooks/use-like-statuses";
import { useStudioQuery } from "@/hooks/use-studio-query";
import { useVideoLike } from "@/hooks/use-video-like";
import { useVideoSave } from "@/hooks/use-video-save";
import { videoToFeedVideo } from "@/lib/api/adapters";
import { resolveAuthor } from "@/lib/api/authors";
import { getVideoCounts } from "@/lib/api/interactions";
import { getVideo } from "@/lib/api/videos";
import { formatCount } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { FeedVideo } from "@/types/tiktok";

type Open = (videoId: string, ids?: string[]) => void;

const OpenContext = createContext<Open>(() => {});

/** Opens a post in Studio's own player, over whichever Studio page asked. */
export function useOpenStudioVideo(): Open {
  return use(OpenContext);
}

/**
 * For a cover that stays a link to `/video/{id}`: a plain click opens the post in Studio's
 * player, while a ctrl/cmd/shift or middle click still opens the public page in a new tab.
 */
export function onPlainClick(open: () => void) {
  return (event: React.MouseEvent) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    open();
  };
}

/**
 * TikTok Studio never sends a creator to the public video page: a cover click
 * opens this modal over the page, and the URL stays put. `ids` is the list the
 * cover sat in, for the up/down arrows; without it there are none.
 */
export function StudioVideoProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<{ videoId: string; ids?: string[] } | null>(null);
  const openVideo = useCallback<Open>((videoId, ids) => setOpen({ videoId, ids }), []);

  return (
    <OpenContext value={openVideo}>
      {children}
      {open && <StudioVideoModal {...open} onClose={() => setOpen(null)} />}
    </OpenContext>
  );
}

/** A grey 40px disc over the black stage, as tiktokstudio draws close, arrows and sound. */
const DISC =
  "flex h-10 w-10 items-center justify-center rounded-full bg-[rgb(84_84_84/0.5)] text-white transition-colors hover:bg-[rgb(84_84_84/0.75)]";

/**
 * Measured on tiktokstudio's modal at 1600×748: a black stage, then a 544px
 * white column — author, sound, three counters, then Comments | Creator videos.
 */
function StudioVideoModal({
  videoId,
  ids,
  onClose,
}: {
  videoId: string;
  ids?: string[];
  onClose: () => void;
}) {
  const [id, setId] = useState(videoId);
  const detail = useStudioQuery(`studio-video:${id}`, async (signal) => {
    const raw = await getVideo(id, signal);
    const [author, [counts]] = await Promise.all([
      resolveAuthor(raw.userId),
      // Saves only — a failure must not cost the modal.
      getVideoCounts([id], signal).catch(() => []),
    ]);
    return videoToFeedVideo(raw, author, { counts });
  });

  const index = ids?.indexOf(id) ?? -1;
  const previousId = ids && index > 0 ? ids[index - 1] : null;
  const nextId = ids && index >= 0 && index < ids.length - 1 ? ids[index + 1] : null;
  const video = detail.data;

  return (
    <Modal onClose={onClose} className="flex h-screen w-screen max-w-none rounded-none bg-black shadow-none">
      <div className="relative flex min-w-0 flex-1 items-center justify-center">
        {video ? (
          <Stage key={video.id} video={video} />
        ) : (
          detail.error && <p className="text-[14px] text-white/60">{detail.error}</p>
        )}

        <button type="button" onClick={onClose} aria-label="Close" className={cn(DISC, "absolute top-5 left-5")}>
          <CloseIcon className="h-6 w-6" />
        </button>

        {ids && (
          // Both slots always laid out, so a lone arrow stays where it sits beside its pair.
          <div className="absolute top-1/2 right-5 flex -translate-y-1/2 flex-col gap-4">
            <button
              type="button"
              aria-label="Previous video"
              onClick={() => previousId && setId(previousId)}
              className={cn(DISC, !previousId && "invisible")}
            >
              <ChevronUp className="h-7 w-7" strokeWidth={2.5} />
            </button>
            <button
              type="button"
              aria-label="Next video"
              onClick={() => nextId && setId(nextId)}
              className={cn(DISC, !nextId && "invisible")}
            >
              <ChevronDown className="h-7 w-7" strokeWidth={2.5} />
            </button>
          </div>
        )}
      </div>

      {video && <Sidebar key={video.id} video={video} onSelect={setId} />}
    </Modal>
  );
}

/** The video itself, its timeline and the sound toggle. Keyed by video, so each one starts at 0. */
function Stage({ video }: { video: FeedVideo }) {
  const ref = useRef<HTMLVideoElement>(null);
  const { muted, volume, toggleMuted, changeVolume } = usePlayerSettings();
  const [time, setTime] = useState({ current: 0, duration: video.durationSeconds });
  useHlsSource(ref, video.videoUrl);

  useEffect(() => {
    if (ref.current) ref.current.volume = volume;
  }, [volume]);

  const sync = () => {
    const el = ref.current;
    if (el) setTime({ current: el.currentTime, duration: el.duration || video.durationSeconds });
  };

  return (
    <>
      <video
        ref={ref}
        // Left unset for HLS: `useHlsSource` owns the element's source then.
        src={isHlsManifest(video.videoUrl) ? undefined : video.videoUrl || undefined}
        poster={video.posterUrl || undefined}
        autoPlay
        loop
        playsInline
        muted={muted}
        onTimeUpdate={sync}
        onLoadedMetadata={sync}
        onClick={(event) => {
          const el = event.currentTarget;
          if (el.paused) void el.play();
          else el.pause();
        }}
        className="h-full w-full cursor-pointer object-contain"
      />

      <div className="absolute bottom-8 left-1/2 w-[360px] max-w-[60%] -translate-x-1/2">
        <SeekBar
          currentTime={time.current}
          duration={time.duration}
          onSeek={(fraction) => {
            const el = ref.current;
            if (el && time.duration > 0) el.currentTime = Math.min(Math.max(fraction, 0), 1) * time.duration;
          }}
        />
      </div>

      <div className="absolute right-5 bottom-5">
        <VerticalVolumeControl
          muted={muted}
          volume={volume}
          onToggleMuted={toggleMuted}
          onVolumeChange={changeVolume}
        />
      </div>
    </>
  );
}

/**
 * The white column. `tt-light` repaints the feed's comment components, which
 * tiktokstudio reuses here, on white.
 */
function Sidebar({ video, onSelect }: { video: FeedVideo; onSelect: (videoId: string) => void }) {
  const [tab, setTab] = useState<"comments" | "creator">("comments");
  const [extraComments, setExtraComments] = useState(0);
  const comments = video.stats.comments + extraComments;

  // The feed's heart and bookmark, seeded for this one video. Studio is signed in by the time this opens.
  const ids = useMemo(() => [video.id], [video.id]);
  const { user } = useSession();
  const likes = useLikeStatuses(ids, user?.userId);
  const like = useVideoLike({
    videoId: video.id,
    serverLiked: likes.liked[video.id] ?? false,
    serverCount: likes.counts[video.id] ?? video.stats.likes,
    onConfirmed: likes.confirm,
  });
  const save = useVideoSave(video.id, user !== null);

  return (
    <div className="tt-light flex w-[544px] flex-none flex-col bg-white text-black">
      <div className="flex flex-none flex-col px-6 pt-[30px] pb-4">
        <Link href={`/@${video.author.username}`} className="flex min-w-0 items-center gap-3 hover:opacity-80">
          {/* eslint-disable-next-line @next/next/no-img-element -- avatar host is whatever user-service allowed */}
          <img
            src={video.author.avatarUrl}
            alt=""
            referrerPolicy="no-referrer"
            className="h-10 w-10 flex-none rounded-full bg-black/8 object-cover"
          />
          <span className="truncate text-[16px] leading-[21px]">
            <span className="font-semibold">{video.author.nickname}</span>
            {video.createdAt && <span className="text-black/48"> · {formatPostDate(video.createdAt)}</span>}
          </span>
        </Link>

        <p className="mt-2 flex min-w-0 items-center gap-1 text-[14px] leading-[18px] font-bold">
          <Music className="h-4 w-4 flex-none" aria-hidden />
          <span className="truncate">{video.music.title}</span>
        </p>

        <div className="mt-3.5 flex items-center gap-5">
          <Counter
            icon={HeartIcon}
            label="Like"
            value={like.likeCount}
            active={like.liked}
            activeColor="text-[#fe2c55]"
            onClick={like.toggleLike}
          />
          {!video.commentsDisabled && (
            <Counter icon={CommentIcon} label="Comments" value={comments} onClick={() => setTab("comments")} />
          )}
          <Counter
            icon={BookmarkIcon}
            label="Save"
            value={video.stats.bookmarks + Number(save.saved) - Number(save.savedAtLoad)}
            active={save.saved}
            activeColor="text-[#facc15]"
            onClick={save.toggleSave}
          />
        </div>
      </div>

      <div role="tablist" className="flex flex-none border-b border-black/12 px-9">
        <Tab active={tab === "comments"} onClick={() => setTab("comments")}>
          Comments
        </Tab>
        <Tab active={tab === "creator"} onClick={() => setTab("creator")}>
          Creator videos
        </Tab>
      </div>

      <div className="min-h-0 flex-1">
        {tab === "comments" ? (
          <CommentPanel
            variant="detail"
            showHeader={false}
            videoId={video.id}
            videoOwnerId={video.author.userId}
            commentsDisabled={video.commentsDisabled}
            commentCount={comments}
            onClose={() => {}}
            onCommentAdded={() => setExtraComments((n) => n + 1)}
            onCommentDeleted={() => setExtraComments((n) => n - 1)}
          />
        ) : (
          <CreatorVideosPanel userId={video.author.userId} currentVideoId={video.id} onSelect={onSelect} />
        )}
      </div>
    </div>
  );
}

/** One of the three counters: heart and bookmark toggle (they carry `activeColor`), the comment bubble opens the Comments tab. */
function Counter({
  icon: Icon,
  label,
  value,
  active = false,
  activeColor,
  onClick,
}: {
  icon: typeof HeartIcon;
  label: string;
  value: number;
  active?: boolean;
  activeColor?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span
        className={cn(
          "flex h-8 w-8 items-center justify-center rounded-full bg-[rgb(22_24_35/0.06)] transition-colors",
          onClick && "group-hover:bg-[rgb(22_24_35/0.12)]",
          active && activeColor,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <span className="text-[13px] leading-[17px] font-medium text-black/65">{formatCount(value)}</span>
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={activeColor ? active : undefined}
      className="group flex items-center gap-1.5"
    >
      {body}
    </button>
  ) : (
    <span className="flex items-center gap-1.5" aria-label={`${formatCount(value)} ${label}`}>
      {body}
    </span>
  );
}

function Tab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative h-[38px] flex-1 text-[14px] leading-[18px]",
        active
          ? "font-bold text-black after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:bg-black"
          : "font-medium text-black/48 hover:text-black/65",
      )}
    >
      {children}
    </button>
  );
}
