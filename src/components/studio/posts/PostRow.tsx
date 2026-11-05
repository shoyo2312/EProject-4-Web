"use client";

import {
  Download,
  Ellipsis,
  MessageCircleMore,
  PenLine,
  Pin,
  PinOff,
  SquareActivity,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PostCell } from "@/components/studio/PostCell";
import { MenuOption, Popover } from "@/components/studio/ui";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/components/ui/toast";
import { Tooltip } from "@/components/ui/Tooltip";
import { messageFor } from "@/lib/api/errors";
import type { VideoResponse } from "@/lib/api/types";
import { deleteVideo, updateVideoPinned, updateVideoVisibility } from "@/lib/api/videos";
import { downloadFile } from "@/lib/download";
import { isHlsManifest } from "@/hooks/use-hls-source";
import { formatCount } from "@/lib/format";
import { PRIVACY_LABEL, VISIBILITIES } from "@/lib/studio/overview";
import { videoFileName } from "@/lib/studio/posts";
import { cn } from "@/lib/utils";

export const POSTS_GRID = "grid grid-cols-[minmax(0,1fr)_120px_96px_96px_104px_160px] items-center gap-4";

/** TikTok Studio's row action: a 34px hairline circle. */
const ACTION =
  "flex h-[34px] w-[34px] flex-none items-center justify-center rounded-full border border-black/8 text-black transition-colors hover:bg-black/5";

/**
 * One row of the Posts table. Actions as on TikTok Studio — Edit, View analytics,
 * View comments, each labelled on hover — then ⋯ for Pin to top, Download, Delete.
 */
export function PostRow({
  video,
  onChange,
  onDelete,
}: {
  video: VideoResponse;
  onChange: (video: VideoResponse) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const pinned = Boolean(video.pinnedAt);
  const fail = (cause: unknown) => toast.error(messageFor(cause));

  const pin = () =>
    updateVideoPinned(video.id, !pinned)
      .then((updated) => {
        onChange(updated);
        toast.success(pinned ? "Unpinned" : "Pinned to the top of your profile");
      })
      .catch(fail);

  const download = (url: string) => {
    toast.success("Downloading…");
    downloadFile(url, videoFileName(video.title, video.id)).catch(() => toast.error("Could not download this video"));
  };
  // A manifest is a playlist, not a file to save; the hook plays it, nothing downloads it.
  const file = video.hlsUrl && !isHlsManifest(video.hlsUrl) ? video.hlsUrl : null;

  return (
    <li className={cn(POSTS_GRID, "px-5 py-4 text-[14px] transition-colors hover:bg-black/4")}>
      <PostCell video={video} href={`/studio/analytics/${video.id}`} />

      <Popover
        className="w-[160px]"
        trigger={({ open, toggle }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            className="w-fit rounded-[4px] px-2 py-1 text-left font-medium hover:bg-black/4"
          >
            {PRIVACY_LABEL[video.visibility]} ▾
          </button>
        )}
      >
        {(close) =>
          VISIBILITIES.map((value) => (
            <MenuOption
              key={value}
              label={PRIVACY_LABEL[value]}
              selected={value === video.visibility}
              onClick={() => {
                close();
                if (value !== video.visibility) void updateVideoVisibility(video.id, value).then(onChange).catch(fail);
              }}
            />
          ))
        }
      </Popover>

      <span>{formatCount(video.viewCount)}</span>
      <span>{formatCount(video.likeCount)}</span>
      <span>{video.commentCount === null ? "–" : formatCount(video.commentCount)}</span>

      <div className="flex items-center justify-center gap-1.5">
        <ActionLink label="Edit" href={`/studio/content/${video.id}/edit`} icon={PenLine} />
        <ActionLink label="View analytics" href={`/studio/analytics/${video.id}`} icon={SquareActivity} />
        <ActionLink label="View comments" href={`/studio/comment?videoId=${video.id}`} icon={MessageCircleMore} />
        <RowMenu
          pinned={pinned}
          onPin={pin}
          onDownload={file ? () => download(file) : undefined}
          onDelete={() => setConfirming(true)}
        />
      </div>

      {confirming && (
        <Modal onClose={() => setConfirming(false)} className="w-[400px] rounded-[8px] bg-white p-6 text-center text-black">
          <p className="text-[20px] font-bold">Delete this post?</p>
          <p className="mt-2 text-[14px] text-black/65">It is removed from your profile and from everyone&apos;s feed.</p>
          <div className="mt-6 flex gap-3">
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="h-10 flex-1 rounded-[4px] border border-black/12 font-semibold hover:bg-black/3"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() =>
                deleteVideo(video.id)
                  .then(() => {
                    onDelete(video.id);
                    toast.success("Post deleted");
                  })
                  .catch(fail)
                  .finally(() => setConfirming(false))
              }
              className="h-10 flex-1 rounded-[4px] bg-[#fe2c55] font-semibold text-white hover:bg-[#ea284e]"
            >
              Delete
            </button>
          </div>
        </Modal>
      )}
    </li>
  );
}

function ActionLink({ label, href, icon: Icon }: { label: string; href: string; icon: LucideIcon }) {
  return (
    <Tooltip label={label} placement="top" variant="studio">
      <Link href={href} aria-label={label} className={ACTION}>
        <Icon className="h-4 w-4" strokeWidth={2} />
      </Link>
    </Tooltip>
  );
}

/** ⋯ — TikTok's three: Pin to top (Unpin once pinned), Download, Delete in red. */
function RowMenu({
  pinned,
  onPin,
  onDownload,
  onDelete,
}: {
  pinned: boolean;
  onPin: () => void;
  /** Absent while the video has no playable file yet. */
  onDownload?: () => void;
  onDelete: () => void;
}) {
  return (
    <Popover
      align="end"
      className="w-[178px] rounded-[12px] p-2 shadow-[0_4px_16px_rgba(0,0,0,0.12)]"
      trigger={({ open, toggle }) => (
        <button
          type="button"
          onClick={toggle}
          aria-label="More actions"
          aria-haspopup="menu"
          aria-expanded={open}
          className={cn(ACTION, open && "bg-black/5")}
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      )}
    >
      {(close) => (
        <div role="menu" className="flex flex-col gap-0.5">
          <MenuItem
            icon={pinned ? PinOff : Pin}
            label={pinned ? "Unpin" : "Pin to top"}
            onClick={() => {
              close();
              onPin();
            }}
          />
          {onDownload && (
            <MenuItem
              icon={Download}
              label="Download"
              onClick={() => {
                close();
                onDownload();
              }}
            />
          )}
          <MenuItem
            icon={Trash2}
            label="Delete"
            danger
            onClick={() => {
              close();
              onDelete();
            }}
          />
        </div>
      )}
    </Popover>
  );
}

function MenuItem({
  icon: Icon,
  label,
  danger,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  danger?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded-[4px] pr-2.5 pl-2 text-left text-[14px] transition-colors hover:bg-black/4",
        danger ? "text-[#da3123]" : "text-black",
      )}
    >
      <Icon className="h-3.5 w-3.5 flex-none" strokeWidth={2} />
      {label}
    </button>
  );
}
